// utils/sendMail.js
require("dotenv").config();

const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");
require("isomorphic-fetch");


const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

let credential = null;
if (tenantId && clientId && clientSecret) {
  credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
} else {
  console.warn('⚠️  Azure email credentials not configured. Email functionality will be unavailable.');
}
//microsoft
async function getGraphClient() {
  if (!credential) {
    throw new Error('Azure email credentials not configured. Email functionality is unavailable.');
  }
  const token = await credential.getToken("https://graph.microsoft.com/.default");

  return Client.init({
    authProvider: (done) => {
      done(null, token.token);
    },
  });
}

const sendMail = async (to, subject, html, type) => {
  let USE_EMAIL;
  // console.log(type)
  if(type === "booking") {
    USE_EMAIL = process.env.EMAIL_BOOKING
  }
  else{
    USE_EMAIL = process.env.EMAIL_NOREPLY;
  }
  try {
  
       const client = await getGraphClient();

    const message = {                                 
      subject:subject,
      body: {
        contentType: "HTML",
        content: html,
      },
      toRecipients: [
        {
          emailAddress: { address: to },
        },
      ],
    };

    // Send from noreply mailbox
    await client.api(`/users/${USE_EMAIL}/sendMail`).post({ message });
 console.log("mail sent to",  to)
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
    return res.status(500).json({message:"mail sent error"})
  }
};

module.exports = sendMail;
