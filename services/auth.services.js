import { ACCESS_TOKEN_EXPIRY, MILLISECONDS_PER_SECOND, REFRESH_TOKEN_EXPIRY } from "../config/constants.js";

import { and, eq, gte, lt, sql, isNull } from "drizzle-orm";
import { db } from "../config/db.js";
import { oauthAccountsTable, passwordResetTokensTable, sessionsTable, usersTable, verifyEmailTokensTable } from "../drizzle/schema.js";
// import bcrypt from "bcryptjs";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { email } from "zod/v4";
// import { sendEmail } from "../lib/nodemailer.js";
import { sendEmail } from "../lib/send-email.js";
import path from "path";
import ejs, { name } from "ejs"
import fs from "fs/promises"
import mjml2html from "mjml";

export const getUserByEmail = async (email) =>{
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email , email));
    return user;
}

export const createUser = async({name,email,password}) => {
    return await db.insert(usersTable).values({name,email,password}).$returningId();
}

export const hashPassword = async(password) => {
    // const hashedPassword = await bcrypt.hash(password,10)
    const hashedPassword = await argon2.hash(password)
    return hashedPassword;
}

export const comparePassword = async(hash,password) => {
    // return await bcrypt.compare(password,hash);
    return await argon2.verify(hash,password);
}

//!instead od this we have used createAccessToken and createRefreshToken
// export const generateToken = ({id,name,email}) => {
//     return jwt.sign({id,name,email},process.env.JWT_SECRET,{expiresIn : "30d"});
// }

export const createSession = async(userId , {ip,userAgent}) => {
    const [session] = await db.insert(sessionsTable).values({userId,ip,userAgent}).$returningId();
    return session;
}

export const createAccessToken = ({id,name,email,sessionId}) => {
    return jwt.sign({id,name,email,sessionId},process.env.JWT_SECRET,{
        expiresIn : ACCESS_TOKEN_EXPIRY / MILLISECONDS_PER_SECOND, //expiresIn : "15m"
    });
}

export const createRefreshToken = (sessionId) => {
    return jwt.sign({sessionId},process.env.JWT_SECRET,{
        expiresIn : REFRESH_TOKEN_EXPIRY / MILLISECONDS_PER_SECOND, //expiresIn : "1w"
    });
}

export const verifyJWTToken = (token) => {
    return jwt.verify(token,process.env.JWT_SECRET);
}   

export const findSessionById = async(sessionId) => {
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id , sessionId));
    return session;
}

export const findUserById = async(userId) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id , userId)); 
    return user;
}

export const findUserByEmail = async(email) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email , email));
    return user;
}

export const refreshTokens = async(refreshToken) => { //!here we are checking if the refresh token is valid or not by jwt.verify (verifyJWTToken)
    try {
        const decodedToken = verifyJWTToken(refreshToken);
        const currentSession = await findSessionById(decodedToken.sessionId);

        if(!currentSession || !currentSession.valid){
            throw new Error("Invalid Session.");
        }

        const user = await findUserById(currentSession.userId);

        if(!user) throw new Error("Invalid User.");
        
        const userInfo = {
            id : user.id,
            name : user.name,
            email : user.email,
            isEmailValid : user.isEmailValid,
            sessionId : currentSession.id,
        };

        const newAccessToken = createAccessToken(userInfo);
        const newRefreshToken = createRefreshToken(currentSession.id);

        return {
            newAccessToken,
            newRefreshToken,
            user : userInfo,
        };
    } catch (error) {
        console.log("Error : " , error.message);
    }
}

export const clearUserSession = async(sessionId) => {
    await db.delete(sessionsTable).where(eq(sessionsTable.id , sessionId))
};

export const authenticateUser = async({req,res,user,name,email}) => {
    // *we need to create a session
    const session = await createSession(user.id , {
        ip : req.clientIp,   //this is from npm package called requestIp
        userAgent : req.headers["user-agent"]  //req.header has this property already
    })

    const accessToken = createAccessToken({
        id : user.id,
        name : user.name || name, //*only take name , not user.name for postRegister fun , beacuse in req.user only userId is present
        email : user.email || email,  //*same here also
        isEmailValid : false,
        sessionId : session.id
    })

    const refreshToken = createRefreshToken(session.id)

    const baseConfig = {httpOnly : true , secure : true}

    res.cookie("access_token" , accessToken ,{
        ...baseConfig,
        maxAge : ACCESS_TOKEN_EXPIRY,
    });

     res.cookie("refresh_token" , refreshToken ,{
        ...baseConfig,
        maxAge : REFRESH_TOKEN_EXPIRY,
    });
}

export const generateRandomToken = (digit = 8) => {
    const min = 10 ** (digit - 1);  //10000000 , digit-1 = 7 , means 7 0's and including 1 = 8 digit code ,,,means 8 digit minimum code
    const max = 10 ** digit;    //100000000

    return crypto.randomInt(min,max).toString();
}

export const insertVerifyEmailToken = async({userId , token}) => {
    return db.transaction(async (tx) => {
        //*1.if token in table is as it is for more than 1 day then delete that token first 
        //*2.if any other existing tokens are present for same user which are not used at that time , then delete that tokens also 
        //*3.and now insert the fresh , brand new token into verifyEmailTokensTable 
        //*Perform all the operations on the 'tx'

        try {
            await tx.delete(verifyEmailTokensTable).where(lt(verifyEmailTokensTable.expiresAt , sql`CURRENT_TIMESTAMP`)); 
            
            await tx.delete(verifyEmailTokensTable).where(eq(verifyEmailTokensTable.userId , userId));

            await tx.insert(verifyEmailTokensTable).values({userId,token});
        } catch (error) {
            console.log("Failed to insert verification token : " , error);
            throw new Error("Unable to create verifiactoin token.");
        }
    });  
};

// export const createVerifyEmailLink = async({email , token}) => {
//     const uriEncodeEmail = encodeURIComponent(email);

//     return `${process.env.FRONTEND_URL}/verify-email-token?token=${token}&email=${uriEncodeEmail}`
// }

//* The URL API in JavaScript provides an easy way to construct, manipulate, and parse URLs without manual string concatenation. It ensures correct encoding, readability, and security when handling URLs.

//? const url = new URL("https://example.com/profile?id=42&theme=dark");

//! console.log(url.hostname); // "example.com"
//! console.log(url.pathname); // "/profile"
//! console.log(url.searchParams.get("id")); // "42"
//! console.log(url.searchParams.get("theme")); // "dark"

//* 💡 Why Use the URL API?
//? ✅ Easier URL Construction – No need for manual ? and & handling.
//? ✅ Automatic Encoding – Prevents issues with special characters.
//? ✅ Better Readability – Clean and maintainable code.

export const createVerifyEmailLink = async({email , token}) => {
    // return `${process.env.FRONTEND_URL}/verify-email-token?token=${token}&email=${uriEncodeEmail}`;

    const url = new URL(`${process.env.FRONTEND_URL}/verify-email-token`);

    url.searchParams.append("token",token);
    url.searchParams.append("email",email);

    return url.toString();
}

// export const findVerificationEmailToken = async({token,email}) => {
//     //*previously we never write data in select query , but now we want data from db directly so we wrote like this 
//     //!its syntax is db.select({key : table.column})

//     const tokenData = await db  
//         .select({
//             userId : verifyEmailTokensTable.userId,
//             token : verifyEmailTokensTable.token,
//             expiresAt : verifyEmailTokensTable.expiresAt,
//         })
//         .from(verifyEmailTokensTable)
//         .where(
//             and(   //*both query must be correct , if correct then we get data that we are requestig in select query
//                 eq(verifyEmailTokensTable.token , token),
//                 gte(verifyEmailTokensTable.expiresAt , sql`CURRENT_TIMESTAMP`)   //*if expiry time still greater than current access time ,then allow to verify email 
//             )
//         );

//     if(!tokenData.length) return null;
    
//     const { userId } = tokenData[0];    //*tokenData is array because 'select' query always returns array
//     // const userId = tokenData[0].userId; //*both synatx are correct to get userId from the array of tokenData 
    
//     const userData = await db
//         .select({
//             userId : usersTable.id,
//             email : usersTable.email,
//         })
//         .from(usersTable)
//         .where(eq(usersTable.id , userId));

//     if(!userData.length) return null;

//     // console.log(userData);

//     return {
//         userId : userData[0].userId,  //*, userData is array because 'select' query always returns array
//         email : userData[0].email,
//         token : tokenData[0].token, //*here i had wrote userData[0].token and expiresAt but later i recognized that usertable don't have that values , sol i give that values from tokenData
//         expiresAt : tokenData[0].expiresAt, //*same here also
//     };
// };

export const findVerificationEmailToken = async({token,email}) => {
    //*previously we never write data in select query , but now we want data from db directly so we wrote like this 
    //!its syntax is db.select({key : table.column})

   return db  
        .select({
            userId : usersTable.id,
            email : usersTable.email,
            token : verifyEmailTokensTable.token,
            expiresAt : verifyEmailTokensTable.expiresAt,
        })
        .from(verifyEmailTokensTable)
        .where(
            and(   //*both query must be correct , if correct then we get data that we are requestig in select query
                eq(verifyEmailTokensTable.token , token),
                eq(usersTable.email , email),   //*in old fun , we used usersTable.id , userId ,but here we are not passing userid in parameteres so offcourse we don't have it , therfore email is used to check matching ofcorrect user 
                gte(verifyEmailTokensTable.expiresAt , sql`CURRENT_TIMESTAMP`),   //*if expiry time still greater than current access time ,then allow to verify email 
            )
        )
        .innerJoin(usersTable, eq(verifyEmailTokensTable.userId , usersTable.id) )
}

export const verifyUserEmailAndUpdate = async(email) => {
    return db
        .update(usersTable)
        .set({ isEmailValid : true })
        .where(eq(usersTable.email , email));
}

export const clearVerifyEmailTokens = async(userId) => {
    // const [user] = await db.select().from(usersTable).where(eq(usersTable.email,email));
    await db.delete(verifyEmailTokensTable).where(eq(verifyEmailTokensTable.userId,userId));
}


//!THIS SETVICE IS CALLED AT 2 PLACES , 1.AT THE TIME OF POSTREGISTER AND 2.IN PROFILE PAGE , RESEND verify BUTTON
export const sendNewVerifyEmailLink = async({userId,email}) => {
    const randomToken = generateRandomToken();

    await insertVerifyEmailToken({userId ,token : randomToken});
         
    //*creating only verify link 
    const verifyEmailLink = await createVerifyEmailLink({
        email,
        token : randomToken,
    });
    
    // 1: to get the file data
    const mjmlTemplate = await fs.readFile(
        path.join(import.meta.dirname, "..", "emails", "verify-email.mjml"),
        "utf-8"
    );

    // to replace the placeholders present in mjml with the actual values
    const filledTemplate = ejs.render(mjmlTemplate, {
        code: randomToken,
        link: verifyEmailLink,
    });

    // to convert mjml to html
    const htmlOutput = mjml2html(filledTemplate).html;

    //*when i click on the resend verify link then all the work via nodemailer , it first sends the email link on our terminal and after pressing that we go to the etheral mail and able to token and verify email link
    //*see this in npm of nodemailer
    sendEmail({
        to : email,
        subject : "Verify your email",
        html : htmlOutput,
    }).catch(console.error);
};

export const updateUserByName = async({userId,name,avatarUrl}) => {
    const updateFields = { name };
    // Only include avatarUrl in the update when a new one is provided,
    // otherwise we'd overwrite the existing Google/GitHub profile photo with null.
    if (avatarUrl !== undefined) {
        updateFields.avatarUrl = avatarUrl;
    }
    return await db
        .update(usersTable)
        .set(updateFields)
        .where(eq(usersTable.id , userId));
}

export const updateUserPassword = async({userId,newPassword}) => {
    const newHashedPassword = await hashPassword(newPassword);

    return await db
        .update(usersTable)
        .set({password:newHashedPassword})
        .where(eq(usersTable.id , userId));
}

/*  //todo
    *1.create random token for email
    *2.convert into hash token 
    *3.clear the user's previous data from table (delete)
    *4.now we need to insert userrId , hashToken into table
    *5.return the link (create and then return) 
*/
export const createResetPasswordLink = async({userId}) => {
    const randomToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto.createHash("sha256").update(randomToken).digest("hex"); //*tokenHash is the name wriiten in schema of passwordResetTokensTable

    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId,userId));

    await db.insert(passwordResetTokensTable).values({userId,tokenHash});

    return `${process.env.FRONTEND_URL}/reset-password/${randomToken}`;  //*this we are passing to show inside the email at the bottom (href link)
}

export const getResetPasswordToken = async(token) => {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [data] = await db
        .select()
        .from(passwordResetTokensTable)
        .where(
            and(
                eq(passwordResetTokensTable.tokenHash , tokenHash),
                gte(passwordResetTokensTable.expiresAt , sql`CURRENT_TIMESTAMP`)
            )
        );

    return data;

}

export const clearResetPasswordToken = async(userId) => {
    return await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId,userId));
}


export async function getUserWithOauthId({ email, provider }) {
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      isEmailValid: usersTable.isEmailValid,
      providerAccountId: oauthAccountsTable.providerAccountId,
      provider: oauthAccountsTable.provider,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .leftJoin(
      oauthAccountsTable,
      and(
        eq(oauthAccountsTable.provider, provider),
        eq(oauthAccountsTable.userId, usersTable.id)
      )
    );

  return user;
}

export async function linkUserWithOauth({
  userId,
  provider,
  providerAccountId,
  avatarUrl,
}) {
  await db.insert(oauthAccountsTable).values({
    userId,
    provider,
    providerAccountId,
  });

  if (avatarUrl) {
    await db
      .update(usersTable)
      .set({ avatarUrl })
      .where(and(eq(usersTable.id, userId), isNull(usersTable.avatarUrl)));
  }
}

export async function createUserWithOauth({
  name,
  email,
  provider,
  providerAccountId,
  avatarUrl,
}) {
  const user = await db.transaction(async (trx) => {  //*here we used transaction to insert the new user either in both user and oauth table or don't insert new user in anyone 
    const [user] = await trx
      .insert(usersTable)
      .values({
        email,
        name,
        // password: "",
        avatarUrl,
        isEmailValid: true, // we know that google's email are valid
      })
      .$returningId();

    await trx.insert(oauthAccountsTable).values({
      provider,
      providerAccountId,
      userId: user.id,
    });

    return {
      id: user.id,
      name,
      email,
      isEmailValid: true, // not necessary
      provider,
      providerAccountId,
    };
  });

  return user;
}
