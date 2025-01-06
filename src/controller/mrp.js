const { v4: uuidv4 } = require("uuid");
const { db } = require("../config/db");
const { converToPascalCase, formatStamentStrings } = require("../utils/string");
const TABLE = "@GA_MRP";
const DETAIL_TABLE = "@GA_MRP_DETAIL";

function Mrp({ ...args }) {
  const resultingObject = {};
  let i = 0;
  for ([key, val] of Object.entries(args)) {
    if ((val || val === 0) && key != "schema") {
      if (key === "Code" || key === "Name") {
        resultingObject[`${converToPascalCase(key)}`] = val;
      } else {
        resultingObject[`U_${converToPascalCase(key)}`] = val;
      }
    }
    i++;
  }

  return Object.setPrototypeOf(resultingObject, this);
}

async function get(params) {
  const mrp = Mrp(params);

  const data = db.exec(
    `SELECT 
  "MRP"."Code",
  "MRP"."Name",
  "MRP"."U_mrp_id",
  "U_mrp_code",
  "MRP"."U_description",
  "U_brand_code",
  "U_brand_name",
  "U_provider_code",
  "U_provider_name",
  "U_price_total",
  "U_leadtime",
  "MRP"."U_suggested_amount",
  "U_start_year",
  "U_start_month",
  "U_end_year",
  "U_end_month",
  "U_created_date",
  "U_last_modified_date",
  "U_created_by",
  "U_last_modified_by",
  "U_status",
  "U_printed_times",
  "MRPD"."Code" AS "U_detail_code",
  "MRPD"."Name" AS "U_detail_name",
  "MRPD"."U_mrp_id" AS "fk_mrp_id",
  "MRPD"."U_item_code" ,
  "MRPD"."U_factory_item_code" ,
  "MRPD"."U_description" AS "U_detail_description",
  "MRPD"."U_alternative_references",
  "MRPD"."U_model" ,
  "MRPD"."U_inv_stock",
  "MRPD"."U_inv_transit",
  "MRPD"."U_frequency" ,
  "MRPD"."U_rating" ,
  "MRPD"."U_price",
  "MRPD"."U_currency" ,
  "MRPD"."U_suggested_amount" as "U_detail_suggested_amount",
  "MRPD"."U_line_total",
  "MRPD"."U_sales_01",
  "MRPD"."U_sales_02",
  "MRPD"."U_sales_03",
  "MRPD"."U_sales_04",
  "MRPD"."U_sales_05",
  "MRPD"."U_sales_06",
  "MRPD"."U_sales_07",
  "MRPD"."U_sales_08",
  "MRPD"."U_sales_09",
  "MRPD"."U_sales_10",
  "MRPD"."U_sales_11",
  "MRPD"."U_sales_12",
  "MRPD"."U_is_included" 
  FROM "${params?.schema}"."${TABLE}" "MRP"
  JOIN "${
    params?.schema
  }"."${DETAIL_TABLE}" "MRPD" ON ("MRP"."U_mrp_id" = "MRPD"."U_mrp_id")
  ${formatStamentStrings(Object.entries(mrp), "where", "MRP")}
  ORDER BY "MRP"."Code", "MRPD"."Code"`
  );

  const response = [];

  for (item of data) {
    //if (!response.some((sbItem) => sbItem.Code === item.Code)) {
    let isDetailField = false;
    let actualItem = {};
    //actualItem.detail = [];

    for ([key, value] of Object.entries(item)) {
      if (key === "U_detail_code") {
        actualItem.detail = [];
        isDetailField = true;
        actualItem.detail.push({});
      }

      if (isDetailField) {
        actualItem.detail[0][key] = value;
      } else {
        actualItem[key] = value;
      }
    }

    if (response.some((sbItem) => sbItem.Code === item.Code)) {
      let currentIndex = response.findIndex((i) => i.Code == item.Code);

      response[currentIndex].detail.push(actualItem.detail[0]);
    } else {
      response.push(actualItem);
    }
  }

  console.log(response);

  return response;
}

async function create(params, data) {
  console.log("hi");

  try {
    /*PONER ESTO EN UN MIDLEWARE PARA VALIDAR AUTENTICACION Y OTROS DATOS DE LA SESION*/
    if (!params.schema) {
      throw new Error("Schema must be specified on the API request");
    }

    /*CREATING MRP ENTRY IN THE MASTER TABLE*/
    const [{ max_code: Code }] =
      await db.exec(`SELECT COALESCE(MAX(CAST ("Code" AS INTEGER)),0) + 1 AS "max_code"
                    FROM "${params.schema}"."${TABLE}"`);

    const id = uuidv4();
    const detailData = data.detail;

    data.detail = null;

    const mrp = new Mrp({ Code, Name: data.mrpCode, mrpId: id, ...data });

    let statement = `INSERT INTO "${
      params.schema
    }"."${TABLE}"(${formatStamentStrings(
      Object.keys(mrp),
      "keys"
    )}) VALUES(${formatStamentStrings(Object.values(mrp), "values")});`;

    db.setAutoCommit(false);

    await db.exec(statement);

    /*CREATING ENTRIES IN MRP_DETAIL */

    const [{ max_code: detailCode }] =
      await db.exec(`SELECT COALESCE(MAX(CAST ("Code" AS INTEGER)),0) + 1 AS "max_code"
                  FROM "${params.schema}"."${DETAIL_TABLE}"`);

    const detailStatement = detailData.map(
      (item, index) =>
        `INSERT INTO "${params.schema}"."${DETAIL_TABLE}"
           VALUES(\'${detailCode + index}\' , \'${detailCode + index}\', \'${
          mrp.U_mrp_id
        }\', ${formatStamentStrings(Object.values(item), "values")});`
    );

    for (c of detailStatement) {
      await db.exec(c);
    }
    db.commit();

    return { ...mrp, detail: detailData };
  } catch (error) {
    console.log(error);
    db.rollback();
    throw error;
  }
}

async function update(params, data) {
  try {
    /*PONER ESTO EN UN MIDLEWARE PARA VALIDAR AUTENTICACION Y OTROS DATOS DE LA SESION*/
    if (!params.schema) {
      throw new Error("Schema must be specified on the API request");
    }

    if (Object.entries(data).length == 0) {
      throw new Error("Empty body was provided");
    }

    db.setAutoCommit(false);

    //UPDATING MRP ENTRY IN THE MASTER TABLE
    data.Code = null;
    data.Name = null;
    const mrp = new Mrp({ ...data });

    console.log(data);

    let statement = `UPDATE "${
      params.schema
    }"."${TABLE}" SET ${formatStamentStrings(
      Object.entries(mrp),
      "set"
    )} where "Code" = ${params.code}`;
    console.log(statement);

    db.exec(statement);

    db.commit();
    return mrp;
  } catch (error) {
    console.log(error);
    db.rollback();
    throw error;
  }
}

async function remove(params) {
  try {
    const currentMrp = get(params);
    console.log(currentMrp);

    //const statement = `DELETE FROM "${params.schema}"."${TABLE}" WHERE "Code" = ${params.code}`;
    //db.exec(statement);

    return true;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  get,
  create,
  update,
  remove,
};
