import { NextRequest, NextResponse } from "next/server";
import { collections, accountBalances, accountById, accountExport, amountIn, bad, clean, endOfMonth, HttpError, monthStart, paiseToRupees, parseId, spendingEffect, syncToSheets, today } from "@/lib/finance";
import { computeSummary } from "@/lib/ledger";
import { createHash } from "node:crypto";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{path:string[]}>};
const json=(data:any,status=200)=>NextResponse.json(data,{status});
const bodyJson=async(req:NextRequest)=>{if((req.headers.get("content-type")||"").includes("text/csv"))return {};try{return await req.json();}catch{return {};}};
const getSettings=async(c:any)=>await c.settings.findOne({_id:"main"})||{_id:"main",payday:endOfMonth(),reservePaise:50000,currency:"INR"};
const csvLine=(line:string)=>{const out:string[]=[];let field="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&quoted&&line[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=!quoted;else if(ch===","&&!quoted){out.push(field);field="";}else field+=ch;}out.push(field);return out;};

async function dispatch(req:NextRequest,ctx:Ctx){
 const {path}=await ctx.params;const p="/"+path.join("/");const method=req.method;const c=await collections();const b=method==="GET"||method==="HEAD"?{}:await bodyJson(req);
 if(p==="/health"&&method==="GET"){await c.db.command({ping:1});return json({ok:true,status:"ok"});}
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
 if(p==="/settings"&&method==="GET")return json(await getSettings(c));
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
  const doc:any={type:b.type,amountPaise,date,category:clean(b.category||"Other",50),note:clean(b.note,200),accountId:null,createdAt:new Date()};
  if(["expense","income","transfer","lent","repayment","collection","refund"].includes(b.type)){if(!b.accountId)bad("Select the account used for this transaction.");await accountById(c,b.accountId);doc.accountId=String(b.accountId);}
  if(b.type==="transfer"){if(!b.toAccountId||b.toAccountId===b.accountId)bad("Choose two different accounts for a transfer.");await accountById(c,b.toAccountId);doc.toAccountId=String(b.toAccountId);}
  if(["lent","borrowed_expense","repayment","collection"].includes(b.type)){doc.person=clean(b.person,80);if(!doc.person)bad("Enter the other person’s name.");}
  if(b.relatedTransactionId){const related=await c.tx.findOne({_id:parseId(b.relatedTransactionId)});if(!related)bad("Linked transaction not found.");doc.relatedTransactionId=String(related._id);}
  if(b.type==="borrowed_expense"){doc.accountId=null;doc.settled=false;}
  const result=await c.tx.insertOne(doc);void syncToSheets(c,"upsert",doc,result.insertedId);return json({ok:true,id:String(result.insertedId)},201);
 }
 m=p.match(/^\/transactions\/([^/]+)\/(restore|settle)$/);
 if(m&&method==="POST"){
  const id=parseId(m[1]),action=m[2];
  if(action==="restore"){const result=await c.tx.updateOne({_id:id,deletedAt:{$exists:true}},{$unset:{deletedAt:"",deletedByAction:""},$set:{restoredAt:new Date()}});if(!result.modifiedCount)bad("Deleted transaction not found or already restored.",404);const restored=await c.tx.findOne({_id:id});void syncToSheets(c,"upsert",restored,id);return json({ok:true});}
  const original=await c.tx.findOne({_id:id,deletedAt:{$exists:false}});if(!original||!["borrowed_expense","lent"].includes(original.type))bad("Only a loan or borrowed expense can be settled.");if(original.settled)bad("This item is already settled.");
  const accountId=clean(b.accountId,40);await accountById(c,accountId);const settlement:any={type:original.type==="borrowed_expense"?"repayment":"collection",amountPaise:original.amountPaise,date:today(),category:"Friends",note:`Settlement: ${original.note||original.person}`,person:original.person,accountId,relatedTransactionId:String(original._id),createdAt:new Date()};
  const inserted=await c.tx.insertOne(settlement);void syncToSheets(c,"upsert",settlement,inserted.insertedId);await c.tx.updateOne({_id:id},{$set:{settled:true,settledAt:today()}});const updated=await c.tx.findOne({_id:id});void syncToSheets(c,"upsert",updated,id);return json({ok:true});
 }
 m=p.match(/^\/transactions\/([^/]+)$/);
 if(m&&method==="DELETE"){const id=parseId(m[1]),t=await c.tx.findOne({_id:id,deletedAt:{$exists:false}});if(!t)bad("Transaction not found.",404);await c.tx.updateOne({_id:id,deletedAt:{$exists:false}},{$set:{deletedAt:new Date(),deletedByAction:"user"}});void syncToSheets(c,"delete",t,id);return json({ok:true,undoAvailable:true});}
 if(m&&method==="PUT"){
  const id=parseId(m[1]),original=await c.tx.findOne({_id:id,deletedAt:{$exists:false}});if(!original)bad("Transaction not found.",404);if(original.settled)bad("Settled transactions cannot be edited. Add a correcting transaction instead.");
  const amountPaise=amountIn(b.amount),date=clean(b.date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+"T00:00:00")))bad("Enter a valid transaction date.");
  const revision={amountPaise:original.amountPaise,date:original.date,category:original.category,note:original.note||"",changedAt:new Date()};
  await c.tx.updateOne({_id:id},{$set:{amountPaise,date,category:clean(b.category||original.category||"Other",50),note:clean(b.note,200),updatedAt:new Date()},$push:{revisions:{$each:[revision],$slice:-20}}} as any);
  const updated=await c.tx.findOne({_id:id});if(!updated)bad("Transaction not found.",404);void syncToSheets(c,"upsert",updated,id);return json({ok:true,transaction:{...updated,_id:String(updated._id),amount:paiseToRupees(updated.amountPaise)}});
 }
 if(p==="/budgets"&&method==="GET"){const list=await c.budgets.find().sort({category:1}).toArray();return json(list.map((x:any)=>({...x,amount:paiseToRupees(x.amountPaise),_id:String(x._id)})));}
 if(p==="/budgets"&&method==="POST"){const category=clean(b.category,50),amountPaise=amountIn(b.amount);if(!category)bad("Category is required.");await c.budgets.updateOne({category},{$set:{category,amountPaise,updatedAt:new Date()}},{upsert:true});return json({ok:true});}
 if(p==="/goals"&&method==="GET"){const list=await c.goals.find().sort({createdAt:-1}).toArray();return json(list.map((g:any)=>({...g,target:paiseToRupees(g.targetPaise),saved:paiseToRupees(g.savedPaise),_id:String(g._id)})));}
 if(p==="/goals"&&method==="POST"){const name=clean(b.name,80),targetPaise=amountIn(b.target),savedPaise=Math.max(0,Math.round(Number(b.saved||0)*100));if(!name)bad("Goal name is required.");await c.goals.insertOne({name,targetPaise,savedPaise,createdAt:new Date()});return json({ok:true});}
 if(p==="/recurring"&&method==="GET")return json(await c.recurring.find().sort({dueDay:1}).toArray());
 if(p==="/recurring"&&method==="POST"){const name=clean(b.name,80),amountPaise=amountIn(b.amount),dueDay=Number(b.dueDay);if(!name)bad("Name is required.");if(!Number.isInteger(dueDay)||dueDay<1||dueDay>31)bad("Due day must be between 1 and 31.");await c.recurring.insertOne({name,amountPaise,dueDay,category:clean(b.category||"Subscriptions",50),active:true,createdAt:new Date()});return json({ok:true});}
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
   const imported={importKey:row.importKey,importSource:"csv",type:row.type==="income"?"income":"expense",amountPaise:amountIn(row.amount),date:clean(row.date,10),category:"Needs review",note:clean(row.description,200),accountId,needsReview:true,createdAt:new Date()};const result=await c.tx.insertOne(imported);void syncToSheets(c,"upsert",imported,result.insertedId);added++;
  }return json({added,skipped,reviewRequired:added});
 }
 if(p==="/sheets/sync-all"&&method==="POST"){
  if(!process.env.GOOGLE_SHEETS_WEB_APP_URL||!process.env.GOOGLE_SHEETS_SECRET)bad("Configure GOOGLE_SHEETS_WEB_APP_URL and GOOGLE_SHEETS_SECRET in environment first.");
  const all=await c.tx.find().sort({date:1,createdAt:1}).toArray();for(const item of all)await syncToSheets(c,"upsert",item,item._id);return json({ok:true,attempted:all.length,message:"Sync attempted. Check server logs for sync errors."});
 }
 if(p==="/summary"&&method==="GET"){
  const t=today(),[st,monthRows,unpaidRows,balances]=await Promise.all([
   getSettings(c),c.tx.find({deletedAt:{$exists:false},date:{$gte:monthStart(t),$lte:endOfMonth(t)}},{projection:{date:1,type:1,amountPaise:1,category:1,settled:1}}).toArray(),
   c.tx.find({deletedAt:{$exists:false},type:{$in:["borrowed_expense","lent"]},settled:{$ne:true}},{projection:{type:1,amountPaise:1}}).toArray(),accountBalances(c)]);
  const r=computeSummary({today:t,payday:st.payday,reservePaise:Number(st.reservePaise||0),monthRows:monthRows as any,unpaidRows:unpaidRows as any,balancesPaise:balances.map((a:any)=>a.balancePaise)});
  const {todaySpent,monthSpent,monthIncome,owedToFriends,owedByFriends,byCat,cash,days,reserve,spendable}=r;
  return json({settings:{...st,reserve:paiseToRupees(reserve)},accounts:balances.map((a:any)=>({id:String(a._id),name:a.name,institution:a.institution||"",kind:a.kind,balance:paiseToRupees(a.balancePaise)})),totalBalance:paiseToRupees(cash),spendable:paiseToRupees(spendable),owedToFriends:paiseToRupees(owedToFriends),owedByFriends:paiseToRupees(owedByFriends),days,perDay:paiseToRupees(r.perDay),todaySpent:paiseToRupees(todaySpent),monthSpent:paiseToRupees(monthSpent),monthIncome:paiseToRupees(monthIncome),byCat:Object.fromEntries(Object.entries(byCat).map(([k,v])=>[k,paiseToRupees(v)]))});
 }
 return json({error:"Not found."},404);
}
async function handler(req:NextRequest,ctx:Ctx){try{return await dispatch(req,ctx);}catch(error){console.error(error);const status=error instanceof HttpError?error.status:500;return json({error:status===500?"Server error. Check the application logs.":(error as Error).message},status);}}
export const GET=handler,POST=handler,PUT=handler,DELETE=handler;
