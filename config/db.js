import { drizzle } from "drizzle-orm/mysql2";
export const db = drizzle(process.env.DATABASE_URL);

//!2nd way - gpt
// import mysql from "mysql2/promise";
// import { drizzle } from "drizzle-orm/mysql2";

// const pool = mysql.createPool(process.env.DATABASE_URL);

// export const db = drizzle(pool);

// //!3rd way - gpt
// import mysql from "mysql2/promise";
// import { drizzle } from "drizzle-orm/mysql2";

// const url = new URL(process.env.DATABASE_URL);

// const pool = mysql.createPool({
//   host: url.hostname,
//   port: url.port,
//   user: url.username,
//   password: url.password,
//   database: url.pathname.substring(1),
// });

// export const db = drizzle(pool);
