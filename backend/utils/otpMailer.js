import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config({path:'.env.mail'});
let testSender;
export function setOtpMailSenderForTests(sender){if(process.env.NODE_ENV!=='test')throw new Error('Test sender is unavailable.');testSender=sender;}
export function smtpConfigured(){return process.env.NODE_ENV==='test'?!!testSender:!!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD);}
export async function sendVerificationCode(email,code){
 if(process.env.NODE_ENV==='test'){if(!testSender)throw new Error('Test email sender missing');return testSender(email,code);}
 if(!smtpConfigured())throw new Error('Email service not configured');
 const port=Number(process.env.SMTP_PORT||587);
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
 try{const result=await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:email,subject:'CampusCart: verify your NITH email',text:`Your CampusCart verification code is ${code}. It expires in 10 minutes. Do not share this code. If you did not request an account, ignore this email.`});if(!result.accepted?.length)throw new Error('Email not accepted');}finally{transport.close();}
}
