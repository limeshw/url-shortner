import { varchar } from "drizzle-orm/mysql-core";
import z from "zod"
import { email } from "zod/v4";

const nameSchema = z
    .string()
    .trim()
    .min(3 , {message : "Name must be at least 3 characters long."})
    .max(100,{message : "Name must be no more than 100 characters."});

const emailSchema = z
    .string()
    .trim()
    .email({message:"Please enter a valid email address."})
    .max(100,{message:"Email must be no more than 100 characters."});

export const loginUserSchema = z.object({
    email : emailSchema,

    password : z
    .string()
    .min(6, {message:"Password must be at least 6 characters long."})
    .max(100 , {message:"Password must be no more than 100 characters."})
});

export const registerUserSchema = loginUserSchema.extend({ //*in registraion and login fields are same for validation , so we only added name field in registraion by extending the login schema
    name : nameSchema,
});

export const verifyEmailSchema = z.object({
    token : z.string().trim().length(8),
    email : z.string().trim().email(),
});

export const verifyUserSchema = z.object({
    name : nameSchema,    
});

export const verifyPasswordSchema = z
    .object({
        currentPassword: z
            .string()
            .min(1 , {message : "Current Password is required."}),

        newPassword: z
            .string()
            .min(6 , {message : "New Password must be at least 6 characters long."})
            .max(100 , {message : "New Password must be no more than 100 characters."}),

        confirmPassword: z
            .string()
            .min(6 , {message : "Confirm Password must be at least 6 characters long."})
            .max(100 , {message : "Confirm Password must be no more than 100 characters."}),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message : "Password don't match.",
        path: ["confirmPassword"],  //!Error will be associated with confirmPassword field, means if error occured then it is shown just below the confirm password block
    });  //*this .refine is inbuilt fun which helps to match both password


export const forgotPasswordSchema = z.object({
    email : emailSchema,
});


const passwordSchema = z
    .object({
        newPassword: z
            .string()
            .min(6 , {message : "New Password must be at least 6 characters long."})
            .max(100 , {message : "New Password must be no more than 100 characters."}),

        confirmPassword: z
            .string()
            .min(6 , {message : "Confirm Password must be at least 6 characters long."})
            .max(100 , {message : "Confirm Password must be no more than 100 characters."}),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message : "Password don't match.",
        path: ["confirmPassword"],  //!Error will be associated with confirmPassword field, means if error occured then it is shown just below the confirm password block
    });  //*this .refine is inbuilt fun which helps to match both password

export const verifyResetPasswordSchema = passwordSchema;
export const setPasswordSchema = passwordSchema;