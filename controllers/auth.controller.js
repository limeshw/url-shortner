import { error } from "console";
import { authenticateUser, clearResetPasswordToken, clearUserSession, clearVerifyEmailTokens, comparePassword, createResetPasswordLink, createUser, createUserWithOauth, createVerifyEmailLink, findUserByEmail, findUserById, findVerificationEmailToken, generateRandomToken, getResetPasswordToken, /*generateToken,*/ getUserByEmail, getUserWithOauthId, hashPassword, insertVerifyEmailToken, linkUserWithOauth, sendNewVerifyEmailLink, updateUserByName, updateUserPassword, verifyUserEmailAndUpdate } from "../services/auth.services.js";
import { getAllShortLinks } from "../services/shortener.services.js";
import { forgotPasswordSchema, loginUserSchema, registerUserSchema, setPasswordSchema, verifyEmailSchema, verifyPasswordSchema, verifyResetPasswordSchema, verifyUserSchema } from "../validators/auth-validator.js";
import { sendEmail } from "../lib/send-email.js";
import { email } from "zod/v4";
import { getHtmlFromMjmlTemplate } from "../lib/get-Html-From-Mjml-Template.js";
import { decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { OAUTH_EXCHANGE_EXPIRY } from "../config/constants.js";
import { google } from "../lib/oauth/google.js";
import { github } from "../lib/oauth/github.js";

export const getRegisterPage = (req,res) => {
    if (req.user) return res.redirect("/"); //if token already exist , then no need to login and register dorectly go on home page

    return res.render(
        "../views/auth/register",
        {errors:req.flash("errors")} //retrieving the flash msg from session 
    );
}

export const postRegister = async (req,res) => {
    // console.log(req.body);
    if (req.user) return res.redirect("/");

    const {data,error} = registerUserSchema.safeParse(req.body) //zod validation
    
    if(error){
        const errors = error.errors[0].message; //in error field that we are getting from  req.body has the array of errors and in taht array of errors there is field named message that we need to display in flash msg
        req.flash("errors" , errors);
        return res.redirect("/register")
    }

    const {name , email , password} = data;

    const userExists = await getUserByEmail(email);

    // if(userExists) return res.redirect("/register");
    if(userExists) {
        req.flash("errors" , "User already exists"); //setting the flash msg in session
        return res.redirect("/register");
    }

    const hashedPassword = await hashPassword(password)

    const [user] = await createUser({name , email , password : hashedPassword})
    console.log("registered user : " , user);
    
    // return res.redirect("/login"); 
    // !when we register first time then instead of again redirecting to the login page , just redirect to home page (code that is same as postLogin fun) , just take care that , here in req.user we only have userId and don't have other info , so take that info from destructured data
    await authenticateUser({req,res,user,name,email});

    //*This is written becoz after registration u will get verify email link , and sendNewVerifyEmailLink is a service so it can be called by anywhere
    await sendNewVerifyEmailLink({userId : user.id,email}); 
    
    return res.redirect("/");

}
 
export const getLoginPage = (req,res) => {
    if (req.user) return res.redirect("/");

    return res.render(
        "../views/auth/login" ,
        {errors:req.flash("errors")}
    )
} 

export const postLogin = async (req,res) => {
    // res.setHeader("Set-cookie" , "isLoggedIn=true ; path=/;")
    // console.log(req.user);
    
    if (req.user) return res.redirect("/");

    const {data,error} = loginUserSchema.safeParse(req.body)

    if(error){
        const errors = error.errors[0].message; //in error field that we are getting from req.body has the array of errors and in taht array of errors there is field named message that we need to display in flash msg
        req.flash("errors" , errors);
        return res.redirect("/login")
    }

    const {email , password} = data;    

    const user = await getUserByEmail(email);
    
    if(!user) { 
        req.flash("errors" , "Invalid Email or Password");
        return res.redirect("/login")
    } 

    //*For user who are login with google , don't enter pass , they are loggedin directly by google service 
    if (!user.password) {
        // database hash password
        // if password is null
        req.flash(
            "errors",
            "You have created account using social login. Please login with your social account."
        );
        return res.redirect("/login");
    }
    
    //if we have user then there is access of password also , so while using bcrypt.compare give the password from the database to compare
    const isPasswordValid = await comparePassword(user.password,password);    

    if(!isPasswordValid) {
        req.flash("errors" , "Invalid Email or Password");
        return res.redirect("/login")
    }

    // res.cookie("isLoggedIn" , true)
    // const token = generateToken({
    //     id : user.id,
    //     name : user.name,
    //     email : user.email
    // })

    // res.cookie("access_token" , token);

    //!generating session,accesstoken and refreshtoken
    await authenticateUser({req,res,user});

    return res.redirect("/");
}

export const getMe = (req, res) => {
  if (!req.user) return res.send("Not logged in");
  return res.send(`<h1>Hey ${req.user.name} - ${req.user.email}</h1>`);
};

export const logoutUser = async(req,res) => {

    await clearUserSession(req.user.sessionId);

    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    return res.redirect("/login")
}

export const getProfilePage = async(req,res) => {
    if (!req.user) return res.send("Not logged in");

    const user = await findUserById(req.user.id);
    if(!user) return res.redirect("/login");

    const userShortLinks = await getAllShortLinks(user.id);
    // console.log(userShortLinks);
    
    return res.render("auth/profile" , {
        user : {
            id : user.id,
            name : user.name,
            email : user.email,
            isEmailValid : user.isEmailValid,
            hasPassword : Boolean(user.password),
            avatarUrl : user.avatarUrl,
            createdAt : user.createdAt,
            links : userShortLinks,
        }
    });
}

export const getVerifyEmailPage = async(req,res) => {
    if (!req.user) return res.redirect("/login");  //*only "/" by thapa

    const user = await findUserById(req.user.id);
    if(!user || user.isEmailValid) return res.redirect("/");

    return res.render("auth/verify-email" , {
        email : req.user.email,
    });
}

//!following code send verification link after going to verify email page
// export const resendVerificationLink = async(req,res) => {
//     if (!req.user) return res.redirect("/login");  //*only "/" by thapa

//     const user = await findUserById(req.user.id);
//     if(!user || user.isEmailValid) return res.redirect("/");

//     const randomToken = generateRandomToken();

//     await insertVerifyEmailToken({userId : req.user.id ,token : randomToken});
    
//     //*creating only verify link 
//     const verifyEmailLink = await createVerifyEmailLink({
//         email : req.user.email,
//         token : randomToken,
//     });

//     //*when i click on the resend verify link then all the work via nodemailer , it first sends the email link on our terminal and after pressing that we go to the etheral mail and able to token and verify email link
//     //*see this in npm of nodemailer
//     sendEmail({
//         to : req.user.email,
//         subject : "Verify your email",
//         html : `
//             <h1>click the link below to verify your email</h1>
//             <p>You can use the token : <code>${randomToken}</code></p>
//             <a href="${verifyEmailLink}">Verify Email</a>
//         `,
//     }).catch(console.error);

//     //*from above sendEmail fun control not directly comes to here again and doesn't redirects to verify-email route , when we got mail then that appears in out terminal , after we click on that and we opens etheral page,then there is
//     //*verify email href is present on clicking that , we goes to '/verify-email-token' route and then after that we get redirect to verify-email page
//     //*and there is common route for etheral 'verify email' link and 'verify code' on verfy-email page , means either u can enter the token to verify or u can click on the link to get verify , both have same work so route must be same

//     res.redirect("/verify-email");
// };

export const resendVerificationLink = async(req,res) => {
    if (!req.user) return res.redirect("/login");  //*only "/" by thapa

    const user = await findUserById(req.user.id);
    if(!user || user.isEmailValid) return res.redirect("/");

    await sendNewVerifyEmailLink({userId : user.id,email : req.user.email});

    //*from above sendEmail fun control not directly comes to here again and doesn't redirects to verify-email route , when we got mail then that appears in out terminal , after we click on that and we opens etheral page,then there is
    //*verify email href is present on clicking that , we goes to '/verify-email-token' route and then after that we get redirect to verify-email page
    //*and there is common route for etheral 'verify email' link and 'verify code' on verfy-email page , means either u can enter the token to verify or u can click on the link to get verify , both have same work so route must be same

    res.redirect("/verify-email");
};

// verifyEmailToken
export const verifyEmailToken = async(req,res) => {
    // if (!req.user) return res.redirect("/login");
    const { data, error } = verifyEmailSchema.safeParse(req.query);

    if(error) return res.send("Verification link Invalid or Expired.");

    //todo 1: token - same
    //todo 2: expire
    //todo 3: from userId - findout email

    // const token = await findVerificationEmailToken(data);   //!without joins
    const [token] = await findVerificationEmailToken(data);   //!with joins , here [token] used because select qury always return array , & we are destuctring it here
    console.log("🚀 ~ verifyEmailToken ~ token̥:", token);

    if(!token) res.send("Verification link Invalid or Expired.");

    await verifyUserEmailAndUpdate(token.email);  //*on the basis of email ,getting from token, go inside the usersTable and update the value of isEmailValid to 'true' 

    await clearVerifyEmailTokens(token.userId).catch(console.error);

    return res.redirect("/profile");
}

export const getEditProfilePage = async(req,res) => {
    if (!req.user) return res.redirect("/login");

    const user = await findUserById(req.user.id);
    if(!user) res.status(404).send("User not found");
    // console.log(user.name);
    
    return res.render("auth/edit-profile" , {
        name : user.name,
        avatarUrl : user.avatarUrl,
        errors : req.flash("errors"),  //*this error we are passing by getting its value from postEditProfile
    })
}

export const postEditProfile = async(req,res) => {
    if (!req.user) return res.redirect("/login");
    // console.log("User Found : " , req.user);

    console.log(req.body);
    

    const { data,error } = verifyUserSchema.safeParse(req.body);
    console.log("Updated name : " , data);
    
    if (error) {
        const errorMessages = error.errors.map((err) => err.message);
        req.flash("errors", errorMessages);
        return res.redirect("/edit-profile");
    }

    // await updateUserByName({userId : req.user.id , name : data.name});
    const fileUrl = req.file ? `uploads/avatar/${req.file.filename}` : undefined;
    await updateUserByName({
        userId : req.user.id , 
        name : data.name , 
        avatarUrl : fileUrl
    });

    res.redirect("/profile")
}

export const getChangePasswordPage = async(req,res) => {
    if (!req.user) return res.redirect("/login");
    
    return res.render("auth/change-password", {
        errors : req.flash("errors"),
    });
}

export const postChangePassword = async(req,res) => {

    const {data , error} = verifyPasswordSchema.safeParse(req.body);

    if (error) {
        const errorMessages = error.errors.map((err) => err.message);
        req.flash("errors", errorMessages);
        return res.redirect("/change-password");
    }

    const {currentPassword , newPassword} = data;
    // console.log("CURR : " , currentPassword , "NEW : " ,newPassword);
    

    const user = await findUserById(req.user.id);
    // console.log("USER : ",user);
    
    if(!user) res.status(404).send("User not found");

    const isPasswordValid = await comparePassword(user.password,currentPassword);    
    
    if(!isPasswordValid) {
        req.flash("errors" , "Current Password that you entered is Invalid.");
        return res.redirect("/change-password")
    }

    await updateUserPassword({userId : user.id , newPassword})

    return res.redirect("/profile");

}

export const getResetPasswordPage = async(req,res) => {
    return res.render("auth/forgot-password",{
        formSubmitted: req.flash("formSubmitted")[0],   //*this field is given to show on page that the form is submitted , and if form is submitted, one msg is shown on page , that msg is handled in forget-password page , see on that
        errors : req.flash("errors"),
    });
}

export const postForgotPassword = async(req,res) => {
    const {data ,error} = forgotPasswordSchema.safeParse(req.body);

    if (error) {
        const errorMessages = error.errors.map((err) => err.message);
        req.flash("errors", errorMessages[0]);
        return res.redirect("/reset-password");
    }
 
    const {email} = data;

    const user = await findUserByEmail(email);
    /*
    *1.create random token for email
    *2.convert into hash token 
    *3.clear the user's previous data from table (delete)
    *4.now we need to insert userrId , hashToken into table
    *5.return the link (create and then return) 
    */
    if(user){
        const resetPasswordLink = await createResetPasswordLink({userId:user.id});

        const html = await getHtmlFromMjmlTemplate("reset-password-email" , {
            name : user.name,
            link :  resetPasswordLink,
        });

        // console.log("HTML : ",html );
        sendEmail({
            to:user.email,
            subject : "Reset Your Password",
            html,
        });
    }

    req.flash("formSubmitted" ,true); //*this is only to show a message that email has been sent , and if this is false then redirect to same page to enter the email again
    return res.redirect("/reset-password");
}

export const getResetPasswordTokenPage = async(req,res) => {
    const token = req.params.token;
    
    const passwordResetData = await getResetPasswordToken(token);

    if(!passwordResetData) return res.render("auth/wrong-reset-password-token");

    return res.render("auth/reset-password" , {
        formSubmitted: req.flash("formSubmitted")[0],   
        errors : req.flash("errors"),
        token,
    })
}

//! Extract password reset token from request parameters.
//! Validate token authenticity, expiration, and match with a previously issued token.
//! If valid, get new password from request body and validate using a schema (e.g., Zod) for complexity.
//! Identify user ID linked to the token.
//! Invalidate all existing reset tokens for that user ID.
//! Hash the new password with a secure algorithm .
//! Update the user's password in the database with the hashed version.
//! Redirect to login page or return a success response.


export const postResetPasswordToken = async(req,res) => {
    const token = req.params.token;
    
    const passwordResetData = await getResetPasswordToken(token);

    if(!passwordResetData){
        req.flash("errors" , "Password Token is not matching.");
        return res.render("auth/wrong-reset-password-token");
    }

    const {data,error} = verifyResetPasswordSchema.safeParse(req.body);

    if (error) {
        const errorMessages = error.errors.map((err) => err.message);
        req.flash("errors", errorMessages[0]);
        return res.redirect(`/reset-password${token}`);
    }

    const {newPassword} = data;

    const user = await findUserById(passwordResetData.userId);

    await clearResetPasswordToken(user.id);

    await updateUserPassword({userId:user.id , newPassword});

    return res.redirect("/login");
}

//getGoogleLoginPage
export const getGoogleLoginPage = async(req,res) => {
    if(req.user) return res.redirect("/");

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = google.createAuthorizationURL(state, codeVerifier, [
        "openid", // this is called scopes, here we are giving openid, and profile
        "profile", // openid gives tokens if needed, and profile gives user information
        // we are telling google about the information that we require from user.
        "email",
    ]);  
    
    const cookieConfig = {
        httpOnly: true,
        secure: true,
        maxAge: OAUTH_EXCHANGE_EXPIRY,
        sameSite: "lax", // this is such that when google redirects to our website, cookies are maintained
    };

    res.cookie("google_oauth_state", state, cookieConfig);
    res.cookie("google_code_verifier", codeVerifier, cookieConfig);

    res.redirect(url.toString());
}

//*below code is for response after the clicking on continue , where google provides us state on its own , which must same to the value of cookie that is stored in our server(or stored on localstorage)
export const getGoogleLoginCallback = async(req,res) => {
    // google redirects with code, and state in query params
    // we will use code to find out the user
    const { code, state } = req.query;
    console.log(code, state);

    const {
        google_oauth_state: storedState,
        google_code_verifier: codeVerifier,
    } = req.cookies;

    if (
        !code ||
        !state ||
        !storedState ||
        !codeVerifier ||
        state !== storedState  //state = given by google , storedState = stored in localstorage
    ) {
        req.flash(
        "errors",
        "Couldn't login with Google because of invalid login attempt. Please try again!"
        );
        return res.redirect("/login");
    } 
    
    let tokens;
    try {
        // arctic will verify the code given by google with code verifier internally
        tokens = await google.validateAuthorizationCode(code, codeVerifier);
    } catch {
        req.flash(
        "errors",
        "Couldn't login with Google because of invalid login attempt. Please try again!"
        );
        return res.redirect("/login");
    }
    console.log("token google: ", tokens);   

    const claims = decodeIdToken(tokens.idToken());  //idToken is method present in token 
    console.log("claim: ", claims);

    const { sub: googleUserId, name, email, picture } = claims;

    //! There are few things that we should do
    // Condition 1: User already exists with google's oauth linked (user previously used login with google)
    // Condition 2: User already exists with the same email but google's oauth isn't linked  (user previously loggedin maually by using the same mail id which is present in login with google )
    // Condition 3: User doesn't exist.  (coming first time at site)

    
    // if user is already linked then we will get the user 
    let user = await getUserWithOauthId({
        provider: "google",
        email,
    });

    // if user exists but user is not linked with oauth
    if (user && !user.providerAccountId) {   //*jr user ne manually login kela asel tr to present asel user chya table madhe , mg tyala nantr login with google krtanna fakt oauth chya table madhe add karaych , with user id present in the users table
        await linkUserWithOauth({
        userId: user.id,
        provider: "google",
        providerAccountId: googleUserId,
        avatarUrl: picture,
        });
    }

    // if user doesn't exist
    if (!user) {
        user = await createUserWithOauth({
        name,
        email,
        provider: "google",
        providerAccountId: googleUserId,
        avatarUrl: picture,
        });
    }
    await authenticateUser({ req, res, user, name, email });

    res.redirect("/");
}

//getGithubLoginPage
export const getGithubLoginPage = async (req, res) => {
  if (req.user) return res.redirect("/");

  const state = generateState();

  const url = github.createAuthorizationURL(state, ["user:email"]);

  const cookieConfig = {
    httpOnly: true,
    secure: true,
    maxAge: OAUTH_EXCHANGE_EXPIRY,
    sameSite: "lax", // this is such that when google redirects to our website, cookies are maintained
  };

  res.cookie("github_oauth_state", state, cookieConfig);

  res.redirect(url.toString());
};

//getGithubLoginCallback
export const getGithubLoginCallback = async (req, res) => {
  const { code, state } = req.query;
  const { github_oauth_state: storedState } = req.cookies;

  function handleFailedLogin() {
    req.flash(
      "errors",
      "Couldn't login with GitHub because of invalid login attempt. Please try again!"
    );
    return res.redirect("/login");
  }

  if (!code || !state || !storedState || state !== storedState) {
    return handleFailedLogin();
  }

  let tokens;
  try {
    tokens = await github.validateAuthorizationCode(code);
  } catch {
    return handleFailedLogin();
  }

  const githubUserResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`,
    },
  });
  if (!githubUserResponse.ok) return handleFailedLogin();
  const githubUser = await githubUserResponse.json();
  console.log(githubUser);
  
  const { id: githubUserId, name, avatar_url } = githubUser;

  const githubEmailResponse = await fetch(
    "https://api.github.com/user/emails",
    {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
      },
    }
  );
  if (!githubEmailResponse.ok) return handleFailedLogin();

  const emails = await githubEmailResponse.json();
  const email = emails.filter((e) => e.primary)[0].email; // In GitHub we can have multiple emails, but we only want primary email
  if (!email) return handleFailedLogin();

  // there are few things that we should do
  //! Condition 1: User already exists with github's oauth linked
  //! Condition 2: User already exists with the same email but google's oauth isn't linked
  //! Condition 3: User doesn't exist.

  let user = await getUserWithOauthId({
    provider: "github",
    email,
  });

  if (user && !user.providerAccountId) {
    await linkUserWithOauth({
      userId: user.id,
      provider: "github",
      providerAccountId: githubUserId,
      avatarUrl: avatar_url,
    });
  }

  if (!user) {
    user = await createUserWithOauth({
      name,
      email,
      provider: "github",
      providerAccountId: githubUserId,
      avatarUrl: avatar_url,
    });
  }

  await authenticateUser({ req, res, user, name, email });

  res.redirect("/");
};

//getSetPasswordPage
export const getSetPasswordPage = async (req, res) => {
  if (!req.user) return res.redirect("/");

  return res.render("auth/set-password", {
    errors: req.flash("errors"),
  });
};

//postSetPassword
export const postSetPassword = async (req, res) => {
  if (!req.user) return res.redirect("/");

  const { data, error } = setPasswordSchema.safeParse(req.body);

  if (error) {
    const errorMessages = error.errors.map((err) => err.message);
    req.flash("errors", errorMessages);
    return res.redirect("/set-password");
  }

  const { newPassword } = data;

  const user = await findUserById(req.user.id);
  if (user.password) {
    req.flash(
      "errors",
      "You already have your Password, Instead Change your password"
    );
    return res.redirect("/set-password");
  }

  await updateUserPassword({ userId: req.user.id, newPassword });

  return res.redirect("/profile");
};
