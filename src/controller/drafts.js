const host = process.env.PROD_DB_HOST || "10.1.100.146";
const { TABLE: MRP_TABLE } = require("./mrp");
const axios = require("axios");
const { db } = require("../config/db");
async function createPurchaseOrderDraft(params, data) {
  try {
    const res = await axios.post(`http://${host}:50001/b1s/v1/Drafts`, data, {
      headers: {
        "Content-Type": "application/json",
        Cookie: `B1SESSION=${params.sessionId}`,
      },
    });
    console.log(res);
    //CHANGE MRP STATUS TO CLOSE
    db.exec(
      `UPDATE "${params.schema}"."${MRP_TABLE}" SET "U_status" = 'CLOSED' WHERE "U_mrp_id" = '${params.mrpId}'`
    );

    return res.data;
  } catch (error) {
    console.log(error);

    if (error.response.data.error.message) {
      throw new Error(error.response.data.error.message.value);
    } else {
      throw error;
    }
  }
}

module.exports = {
  createPurchaseOrderDraft,
};
