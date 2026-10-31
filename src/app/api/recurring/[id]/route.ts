import { NextRequest,NextResponse } from "next/server";
import { collections,parseId } from "@/lib/finance";
export const runtime="nodejs";
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){const {id}=await ctx.params,b=await req.json().catch(()=>({})),c=await collections(),r=await c.recurring.updateOne({_id:parseId(id)},{$set:{active:Boolean(b.active),updatedAt:new Date()}});return r.matchedCount?NextResponse.json({ok:true}):NextResponse.json({error:"Reminder not found."},{status:404});}
export async function DELETE(_req:NextRequest,ctx:{params:Promise<{id:string}>}){const {id}=await ctx.params,c=await collections(),r=await c.recurring.deleteOne({_id:parseId(id)});return r.deletedCount?NextResponse.json({ok:true}):NextResponse.json({error:"Reminder not found."},{status:404});}
