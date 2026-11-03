import { NextRequest, NextResponse } from "next/server";
import { collections, accountBalances, accountById, accountExport, amountIn, bad, clean, endOfMonth, HttpError, monthStart, paiseToRupees, parseId, spendingEffect, today } from "@/lib/finance";
import { computeSummary } from "@/lib/ledger";
import { createHash } from "node:crypto";
import { verifyFirebaseRequest } from "@/lib/firebase-admin";
import { getDatabase } from "@/lib/mongodb";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{path:string[]}>};
const json=(data:any,status=200)=>NextResponse.json(data,{status});
const bodyJson=async(req:NextRequest)=>{if((req.headers.get("content-type")||"").includes("text/csv"))return {};try{return await req.json();}catch{return {};}};
const getSettings=async(c:any)=>await c.settings.findOne({_id:"main"})||{_id:"main",payday:endOfMonth(),reservePaise:50000,currency:"INR"};
const csvLine=(line:string)=>{const out:string[]=[];let field="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&quoted&&line[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=!quoted;else if(ch===","&&!quoted){out.push(field);field="";}else field+=ch;}out.push(field);return out;};


function parseNotificationTransaction(title:string,text:string,postedAt:number){
 const content=(title+" "+text).replace(/\s+/g," ").trim();
 if(!content || content.length>3500)return null;
 if(/\b(failed|failure|declined|pending|reversed|reversal)\b/i.test(content))return null;
 const amountMatch=content.match(/(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
 if(!amountMatch)return null;
 const amount=Number(amountMatch[1].replace(/,/g,""));
 if(!Number.isFinite(amount)||amount<=0||amount>100000000)return null;
 const direction=/\b(credited|received|money added|deposit successful)\b/i.test(content)?"INCOME":
  (/\b(debited|sent|paid|withdrawn|payment successful|transferred)\b/i.test(content) || (/\b(autopay|auto[ -]?debit|standing instruction)\b/i.test(content)&&/\b(successful|processed|executed|paid)\b/i.test(content)))?"EXPENSE":null;
 if(!direction)return null;
 const reference=content.match(/(?:UPI\s*(?:Ref(?:erence)?(?:\s*No\.?)?|ID)|Txn\s*(?:ID|Ref)|Transaction\s*ID|RRN)\s*[:#.-]?\s*([A-Za-z0-9-]{8,})/i)?.[1]||null;
 const accountSuffix=content.match(/(?:A\/c|account|from)\s*[*Xx-]*([0-9]{4})\b/i)?.[1]||null;
 const counterpartyPattern=direction==="EXPENSE"
  ? /\b(?:sent|paid|transferred)\s+(?:Rs\.?\s*[0-9,.]+\s+)?(?:from\s+[*Xx0-9-]+\s+)?to\s+(.+?)(?=\s+(?:on\s+\d|UPI\s+ref|ref(?:erence)?\s+no)|[,.]|$)/i
  : /\b(?:received\s+from|credited\s+(?:by|from))\s+(.+?)(?=\s+(?:on\s+\d|RRN|UPI\s+ref|available\s+balance)|[,.]|$)/i;
 const autoDebitParty=direction==="EXPENSE"?content.match(/\b(?:autopay|auto[ -]?debit|standing instruction)\b.*?\bto\s+(.+?)(?=\s+on\s+\d|[,.]|$)/i)?.[1]?.trim().slice(0,100)||null:null;
 const counterparty=counterpartyPattern.exec(content)?.[1]?.trim().slice(0,100)||autoDebitParty;
 const bankName=content.match(/[-–]\s*([A-Za-z][A-Za-z &]{1,40})\s*$/)?.[1]?.trim()||title.trim().slice(0,80)||null;
 const dateMatch=content.match(/\bon\s+(\d{1,2})[-/ ]([A-Za-z]{3,9}|\d{1,2})[-/ ](\d{2,4})/i);
 let date=new Date(postedAt||Date.now()).toISOString().slice(0,10);
 if(dateMatch){const monthNames=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];const monthToken=dateMatch[2].toLowerCase();const month=Number.isNaN(Number(monthToken))?monthNames.findIndex(name=>name===monthToken.slice(0,3))+1:Number(monthToken);const year=Number(dateMatch[3].length===2?"20"+dateMatch[3]:dateMatch[3]);if(month>=1&&month<=12)date=year+"-"+String(month).padStart(2,"0")+"-"+String(Number(dateMatch[1])).padStart(2,"0");}
 return {amountPaise:Math.round(amount*100),direction,reference,accountSuffix,counterparty,bankName,date};
}

async function dispatch(req:NextRequest,ctx:Ctx){
 const {path}=await ctx.params;const p="/"+path.join("/");const method=req.method;
 if(p==="/health"&&method==="GET"){const db=await getDatabase();await db.command({ping:1});return json({ok:true,status:"ok"});}
 const identity=await verifyFirebaseRequest(req);
 if(!identity)return json({error:"Authentication required. Sign in again."},401);
 const c=await collections(identity);const b=method==="GET"||method==="HEAD"?{}:await bodyJson(req);

 if(p==="/sync/notifications"&&method==="POST"){
  const events=Array.isArray(b.events)?b.events.slice(0,40):[];
  if(!events.length)return json({accepted:0,duplicates:0,ignored:0});
  const inbox=c.db.collection("notification_inbox_"+createHash("sha256").update(identity.uid).digest("hex").slice(0,24));
  await inbox.createIndex({fingerprint:1},{unique:true});
  await inbox.createIndex({detectedAt:-1});
  const allowed=new Set(["com.google.android.apps.nbu.paisa.user","com.phonepe.app","net.one97.paytm","in.org.npci.upiapp","com.kotak811mobilebankingapp.instantsavingsupiscanandpayrecharge","com.google.android.apps.messaging"]);
  let accepted=0,duplicates=0,ignored=0;
  for(const event of events){
   const sourcePackage=clean(event?.sourcePackage,160),title=clean(event?.title,180),text=clean(event?.text,3000);
   if(!allowed.has(sourcePackage)||!text){ignored++;continue;}
   const parsed=parseNotificationTransaction(title,text,Number(event?.postedAt)||Date.now());
   if(!parsed){ignored++;continue;}
   const fallbackKey=createHash("sha256").update(sourcePackage+"|"+title+"|"+text).digest("hex");
   const base=parsed.reference?("ref:"+parsed.reference+":"+parsed.amountPaise):("event:"+fallbackKey+":"+parsed.date+":"+parsed.amountPaise);
   const fingerprint=base+":"+parsed.direction;
   const detectedAt=new Date(Number(event?.postedAt)||Date.now());
   const normalize=(value:string|null|undefined)=>String(value||"").toLowerCase().replace(/[^a-z0-9]/g,"");
   const incomingParty=normalize(parsed.counterparty);
   // Cross-app dedupe: SMS, bank-app and UPI-app alerts for one payment often
   // have different wording (and sometimes different reference formats).
   // Match only across different sources, within a short time window, with
   // amount/date/direction plus a strong reference or account+counterparty match.
   const recent=await inbox.find({
    amountPaise:parsed.amountPaise,direction:parsed.direction,date:parsed.date,
    detectedAt:{$gte:new Date(detectedAt.getTime()-30*60*1000),$lte:new Date(detectedAt.getTime()+30*60*1000)},
    sourcePackage:{$ne:sourcePackage},status:{$in:["PENDING","APPROVED"]}
   }).sort({detectedAt:-1}).limit(30).toArray();
   const crossSourceMatch=recent.find((candidate:any)=>{
    const sameReference=!!parsed.reference&&!!candidate.reference&&normalize(parsed.reference)===normalize(candidate.reference);
    if(sameReference)return true;
    const sameAccount=!!parsed.accountSuffix&&!!candidate.accountSuffix&&parsed.accountSuffix===candidate.accountSuffix;
    const candidateParty=normalize(candidate.counterparty);
    const sameParty=!!incomingParty&&!!candidateParty&&(incomingParty===candidateParty||incomingParty.includes(candidateParty)||candidateParty.includes(incomingParty));
    return sameAccount&&sameParty;
   });
   if(crossSourceMatch){
    await inbox.updateOne({_id:crossSourceMatch._id},{$addToSet:{sourcePackages:sourcePackage,duplicateSources:sourcePackage},$set:{lastDuplicateAt:detectedAt}});
    duplicates++;
    continue;
   }
   const doc={fingerprint,amountPaise:parsed.amountPaise,direction:parsed.direction,reference:parsed.reference,accountSuffix:parsed.accountSuffix,counterparty:parsed.counterparty,bankName:parsed.bankName,date:parsed.date,sourcePackage,sourcePackages:[sourcePackage],detectedAt,status:"PENDING",reviewedAt:null};
   try{
    await inbox.insertOne(doc);accepted++;
    if(parsed.reference){
     const opposite=parsed.direction==="INCOME"?"EXPENSE":"INCOME";
     const other=await inbox.findOne({fingerprint:base+":"+opposite});
     if(other){
      await inbox.updateMany({fingerprint:{$in:[fingerprint,base+":"+opposite]}},{$set:{direction:"TRANSFER",transferCandidate:true,transferGroupKey:base}});
     }
    }
   }catch(error:any){if(error?.code===11000)duplicates++;else throw error;}
  }
  return json({accepted,duplicates,ignored});
 }
 if(p==="/sync/notifications"&&method==="GET"){
  const inbox=c.db.collection("notification_inbox_"+createHash("sha256").update(identity.uid).digest("hex").slice(0,24));
  const rows=await inbox.find({}).sort({detectedAt:-1}).limit(200).toArray();
  const seenTransfers=new Set<string>();
  const visibleRows=rows.filter((row:any)=>{
   if(row.transferGroupKey){
    if(seenTransfers.has(row.transferGroupKey))return false;
    seenTransfers.add(row.transferGroupKey);
   }
   return true;
  });
  return json(visibleRows.slice(0,100).map((row:any)=>({...row,_id:String(row._id),amount:paiseToRupees(row.amountPaise)})));
 }
 if(p==="/sync/notifications"&&method==="GET"){
  const inbox=c.db.collection("notification_inbox_"+createHash("sha256").update(identity.uid).digest("hex").slice(0,24));
  const rows=await inbox.find({}).sort({detectedAt:-1}).limit(100).toArray();
  return json(rows.map((row:any)=>({...row,_id:String(row._id),amount:paiseToRupees(row.amountPaise)})));
 }
 const reviewMatch=p.match(/^\/sync\/notifications\/([^/]+)\/review$/);
 if(reviewMatch&&method==="POST"){
  const inbox=c.db.collection("notification_inbox_"+createHash("sha256").update(identity.uid).digest("hex").slice(0,24));
  const id=parseId(reviewMatch[1]),row=await inbox.findOne({_id:id});
  if(!row)bad("Notification candidate not found.",404);
  const action=clean(b.action,20);
  if(action==="ignore"){
   await inbox.updateOne({_id:id,status:"PENDING"},{$set:{status:"IGNORED",reviewedAt:new Date()}});
   return json({ok:true,status:"IGNORED"});
  }
  if(action!=="approve")bad("Choose approve or ignore.");
  if(row.status==="APPROVED")return json({ok:true,status:"APPROVED",alreadyApproved:true});
  if(row.status!=="PENDING")bad("This notification has already been reviewed.",409);
  const accountId=clean(b.accountId,40),toAccountId=clean(b.toAccountId,40);
  const type=row.direction==="TRANSFER"?"transfer":row.direction==="INCOME"?"income":"expense";
  if(!accountId)bad("Choose the account for this transaction.");
  await accountById(c,accountId);
  if(type==="transfer"){
   if(!toAccountId||toAccountId===accountId)bad("Choose a different destination account for this transfer.");
   await accountById(c,toAccountId);
  }
  const existing=await c.tx.findOne({notificationInboxId:String(id)});
  let transactionId=existing?String(existing._id):null;
  if(!existing){
   const transaction:any={type,amountPaise:Number(row.amountPaise),date:clean(row.date,10),category:clean(b.category||(type==="transfer"?"Transfer":"Needs review"),50),note:clean(b.note||row.counterparty||"Imported from bank notification",200),accountId,notificationInboxId:String(id),notificationReference:row.reference||null,createdAt:new Date()};
   if(type==="transfer")transaction.toAccountId=toAccountId;
   const inserted=await c.tx.insertOne(transaction);transactionId=String(inserted.insertedId);
  }
  const reviewUpdate={$set:{status:"APPROVED",reviewedAt:new Date(),transactionId}};
  if(type==="transfer"&&row.transferGroupKey) await inbox.updateMany({transferGroupKey:row.transferGroupKey,status:"PENDING"},reviewUpdate);
  else await inbox.updateOne({_id:id,status:"PENDING"},reviewUpdate);
  return json({ok:true,status:"APPROVED",transactionId});
 }
 if(p==="/accounts"&&method==="GET")return json((await accountBalances(c)).map((a:any)=>({...a,id:String(a._id),_id:String(a._id),balance:paiseToRupees(a.balancePaise)})));
 if(p==="/accounts"&&method==="POST"){
  const institution=clean(b.institution,80),label=clean(b.name,60),kind=clean(b.kind||(institution==="Cash"?"cash":institution==="UPI"?"upi":"bank"),30);
  let name=label||institution||"Account";if(!label){const existing=await c.accounts.countDocuments({institution});if(existing)name=`${institution} · ${existing+1}`;}
  const openingPaise=Math.round(Number(b.openingBalance||0)*100);if(!Number.isSafeInteger(openingPaise)||openingPaise<0)bad("Opening balance is invalid.");
  const result=await c.accounts.insertOne({name,institution,kind,openingPaise,createdAt:new Date()});return json({ok:true,id:String(result.insertedId)},201);
 }
 let m=p.match(/^\/accounts\/([^/]+)\/export$/);
 if(m&&method==="GET"){const data=await accountExport(c,parseId(m[1]));return new NextResponse(JSON.stringify(data),{headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});}
 m=p.match(/^\/accounts\/([^/]+)$/);
 if(m&&method==="DELETE"){
  const id=parseId(m[1]),data=await accountExport(c,id);const exported=Array.isArray(b.transactionIds)?b.transactionIds.map(String).sort():null;const current=data.transactions.map((x:any)=>x._id).sort();
  if(!exported||exported.length!==current.length||exported.some((v:string,i:number)=>v!==current[i]))bad("The account transaction history changed after export. Download a fresh backup before deleting.",409);
  const ids=exported.map(parseId);if(ids.length)await c.tx.deleteMany({_id:{$in:ids}});await c.accounts.deleteOne({_id:id});return json({ok:true,deletedTransactions:ids.length,deletedAccount:data.account.name});
 }
 if(p==="/financial-plan"&&method==="GET"){
  const st=await getSettings(c),plan=st.financialPlan||{allocationPercentages:{essentials:50,savings:10,personal:25,future:15},financialFloorPaise:0,emergencyTargetPaise:0};
  return json({allocationPercentages:plan.allocationPercentages,financialFloor:paiseToRupees(Number(plan.financialFloorPaise||0)),emergencyTarget:paiseToRupees(Number(plan.emergencyTargetPaise||0))});
 }
 if(p==="/financial-plan"&&method==="PUT"){
  const allocation=b.allocationPercentages||{},keys=["essentials","savings","personal","future"];
  const percentages:any={};let total=0;
  for(const key of keys){const value=Number(allocation[key]);if(!Number.isFinite(value)||value<0||value>100)bad("Allocation percentages must be between 0 and 100.");percentages[key]=value;total+=value;}
  if(Math.abs(total-100)>0.001)bad("Allocation percentages must add up to 100%.");
  const toPaise=(value:unknown,label:string)=>{const n=Number(value);if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(Math.round(n*100)))bad(label+" must be a valid non-negative amount.");return Math.round(n*100);};
  const financialFloorPaise=toPaise(b.financialFloor,"Financial floor"),emergencyTargetPaise=toPaise(b.emergencyTarget,"Emergency target");
  await c.settings.updateOne({_id:"main"},{$set:{financialPlan:{allocationPercentages:percentages,financialFloorPaise,emergencyTargetPaise},updatedAt:new Date()}},{upsert:true});
  return json({ok:true});
 }
 if(p==="/settings"&&method==="GET"){
  const st=await getSettings(c),plan=st.financialPlan;
  return json({...st,financialPlan:plan?{allocationPercentages:plan.allocationPercentages,financialFloor:paiseToRupees(Number(plan.financialFloorPaise||0)),emergencyTarget:paiseToRupees(Number(plan.emergencyTargetPaise||0))}:undefined});
 }
 if(p==="/settings"&&method==="PUT"){
  const payday=clean(b.payday||endOfMonth(),10);if(!/^\d{4}-\d{2}-\d{2}$/.test(payday))bad("Payday must use YYYY-MM-DD.");
  const reservePaise=Math.max(0,Math.round(Number(b.reserve||0)*100));if(!Number.isSafeInteger(reservePaise))bad("Reserve is invalid.");
  await c.settings.updateOne({_id:"main"},{$set:{payday,reservePaise,updatedAt:new Date()}},{upsert:true});return json({ok:true});
 }
 if(p==="/transactions"&&method==="GET"){
  const filter:any={deletedAt:{$exists:false}};const month=req.nextUrl.searchParams.get("month");if(month){if(!/^\d{4}-\d{2}$/.test(month))bad("Month must use YYYY-MM.");filter.date={$regex:`^${month}`};}
  const rows=await c.tx.find(filter).sort({date:-1,createdAt:-1}).limit(500).toArray();return json(rows.map((t:any)=>({...t,amount:paiseToRupees(t.amountPaise),_id:String(t._id)})));
 }
 if(p==="/transactions"&&method==="POST"){
  const allowed=["expense","income","transfer","lent","borrowed_expense","repayment","collection","refund"];if(!allowed.includes(b.type))bad("Choose a valid transaction type.");
  const amountPaise=amountIn(b.amount),date=clean(b.date||today(),10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))bad("Date must use YYYY-MM-DD.");
  const allocationSource=clean(b.allocationSource||"personal",20);if(b.type==="expense"&&!["essentials","personal","future","savings"].includes(allocationSource))bad("Choose a valid allocation wallet.");
  const doc:any={type:b.type,amountPaise,date,category:clean(b.category||"Other",50),note:clean(b.note,200),accountId:null,createdAt:new Date()};if(b.type==="expense")doc.allocationSource=allocationSource;
  if(["expense","income","transfer","lent","repayment","collection","refund"].includes(b.type)){if(!b.accountId)bad("Select the account used for this transaction.");await accountById(c,b.accountId);doc.accountId=String(b.accountId);}
  if(b.type==="transfer"){if(!b.toAccountId||b.toAccountId===b.accountId)bad("Choose two different accounts for a transfer.");await accountById(c,b.toAccountId);doc.toAccountId=String(b.toAccountId);}
  if(["lent","borrowed_expense","repayment","collection"].includes(b.type)){doc.person=clean(b.person,80);if(!doc.person)bad("Enter the other person’s name.");}
  if(b.relatedTransactionId){const related=await c.tx.findOne({_id:parseId(b.relatedTransactionId)});if(!related)bad("Linked transaction not found.");doc.relatedTransactionId=String(related._id);}
  if(b.type==="borrowed_expense"){doc.accountId=null;doc.settled=false;}
  const result=await c.tx.insertOne(doc);return json({ok:true,id:String(result.insertedId)},201);
 }
 m=p.match(/^\/transactions\/([^/]+)\/(restore|settle)$/);
 if(m&&method==="POST"){
  const id=parseId(m[1]),action=m[2];
  if(action==="restore"){const result=await c.tx.updateOne({_id:id,deletedAt:{$exists:true}},{$unset:{deletedAt:"",deletedByAction:""},$set:{restoredAt:new Date()}});if(!result.modifiedCount)bad("Deleted transaction not found or already restored.",404);const restored=await c.tx.findOne({_id:id});return json({ok:true});}
  const original=await c.tx.findOne({_id:id,deletedAt:{$exists:false}});if(!original||!["borrowed_expense","lent"].includes(original.type))bad("Only a loan or borrowed expense can be settled.");if(original.settled)bad("This item is already settled.");
  const accountId=clean(b.accountId,40);await accountById(c,accountId);const settlement:any={type:original.type==="borrowed_expense"?"repayment":"collection",amountPaise:original.amountPaise,date:today(),category:"Friends",note:`Settlement: ${original.note||original.person}`,person:original.person,accountId,relatedTransactionId:String(original._id),createdAt:new Date()};
  const inserted=await c.tx.insertOne(settlement);await c.tx.updateOne({_id:id},{$set:{settled:true,settledAt:today()}});const updated=await c.tx.findOne({_id:id});return json({ok:true});
 }
 m=p.match(/^\/transactions\/([^/]+)$/);
 if(m&&method==="DELETE"){const id=parseId(m[1]),t=await c.tx.findOne({_id:id,deletedAt:{$exists:false}});if(!t)bad("Transaction not found.",404);await c.tx.updateOne({_id:id,deletedAt:{$exists:false}},{$set:{deletedAt:new Date(),deletedByAction:"user"}});return json({ok:true,undoAvailable:true});}
 if(m&&method==="PUT"){
  const id=parseId(m[1]),original=await c.tx.findOne({_id:id,deletedAt:{$exists:false}});if(!original)bad("Transaction not found.",404);if(original.settled)bad("Settled transactions cannot be edited. Add a correcting transaction instead.");
  const amountPaise=amountIn(b.amount),date=clean(b.date,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+"T00:00:00")))bad("Enter a valid transaction date.");
  const type=clean(b.type||original.type,40);
  const allowed=["expense","income","transfer","lent","borrowed_expense","repayment","collection","refund"];
  if(!allowed.includes(type))bad("Choose a valid transaction type.");
  const revision={type:original.type,amountPaise:original.amountPaise,date:original.date,category:original.category,note:original.note||"",person:original.person||"",accountId:original.accountId||null,toAccountId:original.toAccountId||null,allocationSource:original.allocationSource||null,changedAt:new Date()};
  const next:any={type,amountPaise,date,category:clean(b.category||original.category||"Other",50),note:clean(b.note,200),accountId:null,updatedAt:new Date()};
  if(type==="expense"){const allocationSource=clean(b.allocationSource||original.allocationSource||"personal",20);if(!["essentials","personal","future","savings"].includes(allocationSource))bad("Choose a valid allocation wallet.");next.allocationSource=allocationSource;}
  if(["expense","income","transfer","lent","repayment","collection","refund"].includes(type)){
   const accountId=clean(b.accountId||original.accountId,40);
   if(!accountId)bad("Select the account used for this transaction.");
   await accountById(c,accountId);next.accountId=accountId;
  }
  if(type==="transfer"){
   const toAccountId=clean(b.toAccountId||original.toAccountId,40);
   if(!toAccountId||toAccountId===next.accountId)bad("Choose two different accounts for this transfer.");
   await accountById(c,toAccountId);next.toAccountId=toAccountId;
  }
  if(["lent","borrowed_expense","repayment","collection"].includes(type)){
   next.person=clean(b.person||original.person,80);
   if(!next.person)bad("Enter the other person’s name.");
  }
  if(type==="borrowed_expense")next.settled=false;
  const unset:any={};
  if(type!=="transfer")unset.toAccountId="";
  if(type!=="expense")unset.allocationSource="";
  if(!["lent","borrowed_expense","repayment","collection"].includes(type))unset.person="";
  await c.tx.updateOne({_id:id},{$set:next,$unset:unset,$push:{revisions:{$each:[revision],$slice:-20}}} as any);
  const updated=await c.tx.findOne({_id:id});if(!updated)bad("Transaction not found.",404);return json({ok:true,transaction:{...updated,_id:String(updated._id),amount:paiseToRupees(updated.amountPaise)}});
 }
 if(p==="/budgets"&&method==="GET"){const list=await c.budgets.find().sort({category:1}).toArray();return json(list.map((x:any)=>({...x,amount:paiseToRupees(x.amountPaise),_id:String(x._id)})));}
 if(p==="/budgets"&&method==="POST"){const category=clean(b.category,50),amountPaise=amountIn(b.amount);if(!category)bad("Category is required.");await c.budgets.updateOne({category},{$set:{category,amountPaise,updatedAt:new Date()}},{upsert:true});return json({ok:true});}
 m=p.match(/^\/budgets\/([^/]+)$/);
 if(m&&method==="PUT"){const id=parseId(m[1]),category=clean(b.category,50),amountPaise=amountIn(b.amount);if(!category)bad("Category is required.");const result=await c.budgets.updateOne({_id:id},{$set:{category,amountPaise,updatedAt:new Date()}});if(!result.matchedCount)bad("Budget not found.",404);return json({ok:true});}
 if(m&&method==="DELETE"){const result=await c.budgets.deleteOne({_id:parseId(m[1])});if(!result.deletedCount)bad("Budget not found.",404);return json({ok:true});}
 if(p==="/goals"&&method==="GET"){const list=await c.goals.find().sort({createdAt:-1}).toArray();return json(list.map((g:any)=>({...g,target:paiseToRupees(g.targetPaise),saved:paiseToRupees(g.savedPaise),_id:String(g._id)})));}
 if(p==="/goals"&&method==="POST"){const name=clean(b.name,80),targetPaise=amountIn(b.target),savedPaise=Math.max(0,Math.round(Number(b.saved||0)*100));if(!name)bad("Goal name is required.");await c.goals.insertOne({name,targetPaise,savedPaise,createdAt:new Date()});return json({ok:true});}
 m=p.match(/^\/goals\/([^/]+)$/);
 if(m&&method==="PUT"){const id=parseId(m[1]),name=clean(b.name,80),targetPaise=amountIn(b.target),savedPaise=Math.max(0,Math.round(Number(b.saved||0)*100));if(!name)bad("Goal name is required.");const result=await c.goals.updateOne({_id:id},{$set:{name,targetPaise,savedPaise,updatedAt:new Date()}});if(!result.matchedCount)bad("Savings goal not found.",404);return json({ok:true});}
 if(m&&method==="DELETE"){const result=await c.goals.deleteOne({_id:parseId(m[1])});if(!result.deletedCount)bad("Savings goal not found.",404);return json({ok:true});}
 if(p==="/recurring"&&method==="GET")return json(await c.recurring.find().sort({dueDay:1}).toArray());
 if(p==="/recurring"&&method==="POST"){const name=clean(b.name,80),amountPaise=amountIn(b.amount),dueDay=Number(b.dueDay);if(!name)bad("Name is required.");if(!Number.isInteger(dueDay)||dueDay<1||dueDay>31)bad("Due day must be between 1 and 31.");await c.recurring.insertOne({name,amountPaise,dueDay,category:clean(b.category||"Subscriptions",50),active:true,createdAt:new Date()});return json({ok:true});}
 m=p.match(/^\/recurring\/([^/]+)$/);
 if(m&&method==="PUT"){const id=parseId(m[1]),name=clean(b.name,80),amountPaise=amountIn(b.amount),dueDay=Number(b.dueDay);if(!name)bad("Name is required.");if(!Number.isInteger(dueDay)||dueDay<1||dueDay>31)bad("Due day must be between 1 and 31.");const result=await c.recurring.updateOne({_id:id},{$set:{name,amountPaise,dueDay,category:clean(b.category||"Subscriptions",50),updatedAt:new Date()}});if(!result.matchedCount)bad("Recurring reminder not found.",404);return json({ok:true});}
 if(m&&method==="DELETE"){const result=await c.recurring.deleteOne({_id:parseId(m[1])});if(!result.deletedCount)bad("Recurring reminder not found.",404);return json({ok:true});}
 if(p==="/import/preview"&&method==="POST"){
  const text=await req.text();const lines=text.split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)bad("CSV appears empty.");
  const headerIndex=lines.findIndex(l=>/date/i.test(l)&&/(debit|withdrawal|amount)/i.test(l));if(headerIndex<0)bad("Could not identify the CSV columns. Export a CSV with date and debit/credit or amount columns.");
  const headers=csvLine(lines[headerIndex]).map(h=>h.trim().toLowerCase().replace(/^"|"$/g,""));
  const find=(patterns:RegExp[])=>headers.findIndex(h=>patterns.some(x=>x.test(h)));
  const di=find([/^date$/,/transaction date/,/txn date/]),desc=find([/description/,/narration/,/details/,/particulars/]),debit=find([/^debit$/,/withdrawal/,/debit amount/]),credit=find([/^credit$/,/deposit/,/credit amount/]),amount=find([/^amount$/,/transaction amount/]),balance=find([/balance/]);
  if(di<0||(debit<0&&credit<0&&amount<0))bad("CSV columns were not recognised. Please review the file format.");
  const rows:any[]=[];for(const line of lines.slice(headerIndex+1)){const cols=csvLine(line),raw=(cols[di]||"").trim().replace(/^"|"$/g,""),match=raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);if(!match)continue;
   const date=`${match[3]}-${String(match[2]).padStart(2,"0")}-${String(match[1]).padStart(2,"0")}`,num=(v:string)=>Math.round(Math.abs(Number(String(v||"").replace(/[₹,\s"]/g,""))||0)*100);
   let type:string,amountPaise:number;if(debit>=0||credit>=0){const d=num(cols[debit]||""),cr=num(cols[credit]||"");if(!d&&!cr)continue;type=cr?"income":"expense";amountPaise=cr||d;}else{const n=Number(String(cols[amount]||"").replace(/[₹,\s"]/g,""));if(!Number.isFinite(n)||!n)continue;type=n<0?"expense":"income";amountPaise=Math.round(Math.abs(n)*100);}
   const description=clean(cols[desc]||"Imported transaction",200),importKey=createHash("sha256").update([date,type,amountPaise,description,cols[balance]||""].join("|")).digest("hex");rows.push({date,type,amountPaise,amount:paiseToRupees(amountPaise),description,importKey,balance:balance>=0?cols[balance]:""});
  }return json({rows:rows.slice(0,2000),count:rows.length});
 }
 if(p==="/import/commit"&&method==="POST"){
  const rows=Array.isArray(b.rows)?b.rows.slice(0,2000):[],accountId=clean(b.accountId,40);if(!rows.length)bad("No rows selected.");await accountById(c,accountId);let added=0,skipped=0;
  for(const row of rows){if(!row.importKey||!/^[a-f0-9]{64}$/.test(row.importKey)){skipped++;continue;}const exists=await c.tx.findOne({importKey:row.importKey});if(exists){skipped++;continue;}
   const imported={importKey:row.importKey,importSource:"csv",type:row.type==="income"?"income":"expense",amountPaise:amountIn(row.amount),date:clean(row.date,10),category:"Needs review",note:clean(row.description,200),accountId,needsReview:true,createdAt:new Date()};const result=await c.tx.insertOne(imported);added++;
  }return json({added,skipped,reviewRequired:added});
 }
 if(p==="/summary"&&method==="GET"){
  const t=today(),[st,monthRows,unpaidRows,balances,recentRows,latestIncome]=await Promise.all([
   getSettings(c),c.tx.find({deletedAt:{$exists:false},date:{$gte:monthStart(t),$lte:endOfMonth(t)}},{projection:{date:1,type:1,amountPaise:1,category:1,settled:1}}).toArray(),
   c.tx.find({deletedAt:{$exists:false},type:{$in:["borrowed_expense","lent","repayment","collection"]}},{projection:{_id:1,type:1,amountPaise:1,relatedTransactionId:1,person:1,settled:1,date:1}}).sort({date:1,createdAt:1}).toArray(),accountBalances(c),
   c.tx.find({deletedAt:{$exists:false}},{projection:{type:1,amountPaise:1,date:1,category:1,note:1,person:1,accountId:1,settled:1}}).sort({date:-1,createdAt:-1}).limit(5).toArray(),
   c.tx.findOne({deletedAt:{$exists:false},type:"income",category:{$ne:"Friends"},note:{$not:/^old balance$/i}},{sort:{date:-1,createdAt:-1},projection:{date:1,createdAt:1,category:1,note:1}})]);
  const cycleRows=latestIncome?await c.tx.find({deletedAt:{$exists:false},date:{$gte:latestIncome.date},_id:{$ne:latestIncome._id}},{projection:{type:1,amountPaise:1,allocationSource:1}}).toArray():[];
  const cycleCashChange=cycleRows.reduce((sum:number,row:any)=>sum+(["expense","lent","repayment"].includes(row.type)?-Number(row.amountPaise||0):["income","collection","refund"].includes(row.type)?Number(row.amountPaise||0):0),0);
  const allocationCycleBasePaise=Math.max(0,balances.reduce((sum:number,a:any)=>sum+Number(a.balancePaise||0),0)-cycleCashChange);
  const allocationSpentPaise={essentials:0,savings:0,personal:0,future:0};
  const allocationSources=new Set<keyof typeof allocationSpentPaise>(["essentials","savings","personal","future"]);
  for(const row of cycleRows){if(row.type!=="expense"&&row.type!=="refund")continue;const rawSource=String(row.allocationSource||"personal");const source:keyof typeof allocationSpentPaise=allocationSources.has(rawSource as keyof typeof allocationSpentPaise)?rawSource as keyof typeof allocationSpentPaise:"personal";allocationSpentPaise[source]+=Number(row.amountPaise||0)*(row.type==="refund"?-1:1);}

  const percentages=st.financialPlan?.allocationPercentages;
  const allocation=percentages?{
   essentialsPercent:Number(percentages.essentials||0),
   savingsPercent:Number(percentages.savings||0),
   personalPercent:Number(percentages.personal||0),
   futurePercent:Number(percentages.future||0),
  }:undefined;
  const r=computeSummary({today:t,payday:st.payday,reservePaise:Number(st.reservePaise||0),monthRows:monthRows as any,unpaidRows:unpaidRows.map((row:any)=>({...row,_id:String(row._id),relatedTransactionId:row.relatedTransactionId?String(row.relatedTransactionId):undefined})) as any,balancesPaise:balances.map((a:any)=>a.balancePaise),allocation,allocationCycleBasePaise,allocationSpentPaise});
  const {todaySpent,monthSpent,monthIncome,owedToFriends,owedByFriends,byCat,cash,days,reserve,spendable}=r;
  return json({settings:{...st,reserve:paiseToRupees(reserve)},accounts:balances.map((a:any)=>({id:String(a._id),_id:String(a._id),name:a.name,institution:a.institution||"",kind:a.kind,balance:paiseToRupees(a.balancePaise)})),recentTransactions:recentRows.map((row:any)=>({...row,_id:String(row._id),amount:paiseToRupees(row.amountPaise)})),totalBalance:paiseToRupees(cash),spendable:paiseToRupees(spendable),ledgerSpendable:paiseToRupees(r.ledgerSpendable),protectedAllocations:paiseToRupees(r.protectedAllocations),remainingAllocatedSpending:Number.isFinite(r.remainingAllocatedSpending)?paiseToRupees(r.remainingAllocatedSpending):null,owedToFriends:paiseToRupees(owedToFriends),owedByFriends:paiseToRupees(owedByFriends),days,perDay:paiseToRupees(r.perDay),todaySpent:paiseToRupees(todaySpent),monthSpent:paiseToRupees(monthSpent),monthIncome:paiseToRupees(monthIncome),byCat:Object.fromEntries(Object.entries(byCat).map(([k,v])=>[k,paiseToRupees(v)]))});
 }
 return json({error:"Not found."},404);
}
async function handler(req:NextRequest,ctx:Ctx){try{return await dispatch(req,ctx);}catch(error){console.error(error);const status=error instanceof HttpError?error.status:500;return json({error:status===500?"Server error. Check the application logs.":(error as Error).message},status);}}
export const GET=handler,POST=handler,PUT=handler,DELETE=handler;
