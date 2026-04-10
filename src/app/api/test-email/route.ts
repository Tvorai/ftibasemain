import { Resend } from "resend"; 

export const dynamic = 'force-dynamic';
 
 export async function GET() { 
   const resend = new Resend(process.env.RESEND_API_KEY); 
   try { 
     const data = await resend.emails.send({ 
       from: "onboarding@resend.dev", 
       to: "mailfitbase@gmail.com", 
       subject: "Test", 
       html: "<p>Funguje</p>", 
     }); 
 
     return Response.json({ success: true, data }); 
   } catch (err) { 
     return Response.json({ success: false, error: err }); 
   } 
 } 
