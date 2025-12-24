import mjml2html from "mjml";
import fs from "fs/promises"
import path from "path";
import ejs from "ejs"

export const getHtmlFromMjmlTemplate = async(template,data) => {

    //*1.read the data file
    const mjmlTemplate = await fs.readFile(
        path.join(import.meta.dirname, "..", "emails", `${template}.mjml`),
        "utf-8"
    );
    
    //*2.to replace the placeholders present in mjml with the actual values
    const filledTemplate = ejs.render(mjmlTemplate, data);
    
    //*3.to convert mjml to html
    return mjml2html(filledTemplate).html;
}