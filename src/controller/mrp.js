const { v4: uuidv4 } = require("uuid");
const { db } = require("../config/db");
const { converToPascalCase, formatStamentStrings } = require("../utils/string");
const TABLE = "@GA_MRP";
const DETAIL_TABLE = "@GA_MRP_DETAIL";
const { TABLE: BRAND_TABLE } = require("./brand");
const reader = require("xlsx");

function Mrp(
  {
    mrpId,
    mrpCode,
    description,
    brandId,
    models,
    providerCode,
    providerName,
    priceTotal,
    currency,
    suggestedAmount,
    startYear,
    startMonth,
    endYear,
    endMonth,
    createdDate,
    lastModifiedDate,
    createdBy,
    lastModifiedBy,
  },
  params
) {
  let resultingObject = {};

  if (!params?.code) {
    const [{ max_code: newCode }] = db.exec(
      `SELECT COALESCE(MAX(CAST ("Code" AS INTEGER)),0) + 1 AS "max_code"
                  FROM "${params.schema}"."${TABLE}"`
    );
    const newMrpId = uuidv4();

    resultingObject = {
      Code: newCode,
      Name: mrpCode,
      U_mrp_id: mrpId || newMrpId,
      U_mrp_code: mrpCode,
      U_description: description,
      U_brand_id: brandId,
      U_models: models,
      U_provider_code: providerCode,
      U_provider_name: providerName,
      U_price_total: priceTotal,
      U_currency: currency,
      U_leadtime: 0,
      U_suggested_amount: suggestedAmount,
      U_start_year: startYear,
      U_start_month: startMonth,
      U_end_year: endYear,
      U_end_month: endMonth,
      U_created_date: createdDate || getDate(),
      U_last_modified_date: lastModifiedDate || getDate(),
      U_created_by: createdBy,
      U_last_modified_by: lastModifiedBy,
      U_status: "OPENED", //OPENED, CLOSED, CANCELLED
      U_printed_times: 0,
    };
  } else {
    console.log(arguments);

    let i = 0;
    for ([key, val] of Object.entries(arguments[0])) {
      if ((val || val === 0) && key != "schema") {
        if (key === "Code" || key === "Name") {
          resultingObject[`${converToPascalCase(key)}`] = val;
        } else {
          resultingObject[`U_${converToPascalCase(key)}`] = val;
        }
      }
      i++;
    }
  }

  // Object.entries(resultingObject).forEach(([key, val]) => {
  //   if (!val) {
  //     delete resultingObject[key];
  //   }
  // });
  if (params.isUpdating) {
    delete resultingObject.Code;
    delete resultingObject.Name;
    delete resultingObject.U_mrp_id;
    delete resultingObject.U_created_date;
    delete resultingObject.U_created_by;
    delete resultingObject.U_status;
  }
  return Object.setPrototypeOf(resultingObject, this);
}

async function get(params) {
  console.log(params);

  try {
    //const mrp = Mrp(params);

    const statement = `SELECT 
      "MRP"."Code",
      "MRP"."Name",
      "MRP"."U_mrp_id",
      "U_mrp_code",
      "MRP"."U_description",
      "MRP"."U_brand_id",
      "MRP"."U_models",
      "BRD"."U_brand_code",
      "BRD"."U_description" as "brand_description",
      "MRP"."U_currency",
      "U_provider_code",
      "U_provider_name",
      "U_price_total",
      "BRD"."U_leadtime",
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
      "U_printed_times"
    FROM "${params?.schema}"."${TABLE}" "MRP"
    JOIN "${
      params?.schema
    }"."${BRAND_TABLE}" "BRD" ON ("MRP"."U_brand_id" = "BRD"."U_brand_id")
    WHERE "MRP"."U_brand_id" LIKE '${params.brandId || "%"}'
    AND YEAR("MRP"."U_created_date") like '${params.targetYear || "%"}'
    AND MONTH("MRP"."U_created_date") like '${params.targetMonth || "%"}'
    AND "MRP"."U_status" <> 'CANCELED'
    ORDER BY "MRP"."U_created_date" desc,  "BRD"."U_description"`;
    console.log(statement);
    const data = db.exec(statement);

    const response = [];

    // for (item of data) {
    //   //if (!response.some((sbItem) => sbItem.Code === item.Code)) {
    //   let isDetailField = false;
    //   let actualItem = {};
    //   //actualItem.detail = [];

    //   for ([key, value] of Object.entries(item)) {
    //     if (key === "U_detail_code") {
    //       actualItem.detail = [];
    //       isDetailField = true;
    //       actualItem.detail.push({});
    //     }

    //     if (isDetailField) {
    //       actualItem.detail[0][key] = value;
    //     } else {
    //       actualItem[key] = value;
    //     }
    //   }

    //   if (response.some((sbItem) => sbItem.Code === item.Code)) {
    //     let currentIndex = response.findIndex((i) => i.Code == item.Code);

    //     response[currentIndex].detail.push(actualItem.detail[0]);
    //   } else {
    //     response.push(actualItem);
    //   }
    // }

    return data;
  } catch (error) {
    console.log(error);
  }
}

async function getMrpDetailById(params) {
  try {
    //const mrp = Mrp(params);

    const statement = `SELECT 
     
      "Code" AS "U_detail_code",
      "Name" AS "U_detail_name",
      "U_mrp_id" AS "fk_mrp_id",
      "U_item_code" ,
      "U_factory_item_code" ,
      "U_description" AS "U_detail_description",
      "U_factory_detail_description",
      "U_alternative_references",
      "U_model" ,
      "U_inv_stock",
      "U_inv_transit",
      "U_inv_transit" + "U_inv_stock" as "sum_inv_trans",
      "U_frequency" ,
      "U_avg_demand",
      "U_reorder_point",
      "U_rating" ,
      "U_price" as "last_purchase_price",
      "U_actual_price" as "price",
      "U_currency" ,
      "U_suggested_amount" as "U_detail_suggested_amount",
      "U_order_amount",
      "U_line_total",
      "U_sales_01",
      "U_sales_02",
      "U_sales_03",
      "U_sales_04",
      "U_sales_05",
      "U_sales_06",
      "U_sales_07",
      "U_sales_08",
      "U_sales_09",
      "U_sales_10",
      "U_sales_11",
      "U_sales_12",
      "U_is_included"
    FROM "${params?.schema}"."${DETAIL_TABLE}"
    WHERE "U_mrp_id" = '${params?.mrpId}'
    ORDER BY "U_description"`;
    console.log(statement);
    const data = db.exec(statement);

    const response = [];

    // for (item of data) {
    //   //if (!response.some((sbItem) => sbItem.Code === item.Code)) {
    //   let isDetailField = false;
    //   let actualItem = {};
    //   //actualItem.detail = [];

    //   for ([key, value] of Object.entries(item)) {
    //     if (key === "U_detail_code") {
    //       actualItem.detail = [];
    //       isDetailField = true;
    //       actualItem.detail.push({});
    //     }

    //     if (isDetailField) {
    //       actualItem.detail[0][key] = value;
    //     } else {
    //       actualItem[key] = value;
    //     }
    //   }

    //   if (response.some((sbItem) => sbItem.Code === item.Code)) {
    //     let currentIndex = response.findIndex((i) => i.Code == item.Code);

    //     response[currentIndex].detail.push(actualItem.detail[0]);
    //   } else {
    //     response.push(actualItem);
    //   }
    // }

    return data;
  } catch (error) {
    console.log(error);
  }
}

async function getNextMrpByBrand(params) {
  try {
    const statement = `SELECT
    "PREFIX" || LPAD("NUMBER"+1, 8, '0') as "mrp_code"
    FROM (
    SELECT 
        MAX("U_brand_code") AS "PREFIX",
        MAX(COALESCE(SUBSTRING_REGEXPR(CONCAT(BRAND."U_brand_code",'([0-9]+)') IN "U_mrp_code" GROUP 1),0)) AS "NUMBER"
    FROM "${params.schema}"."${TABLE}" MRP
    RIGHT JOIN "${params.schema}"."${BRAND_TABLE}" BRAND ON (MRP."U_brand_id" = BRAND."U_brand_id" AND MRP."U_status" <> 'CANCELED' )
    WHERE BRAND."U_brand_id" = '${params.brandId}')`;

    console.log(statement);

    const [{ mrp_code }] = await db.exec(statement);

    console.log("####", mrp_code, statement);

    return { next: mrp_code };
  } catch (error) {
    console.log(error);
  }
}

async function create(params, data) {
  console.log("hi");

  try {
    /*PONER ESTO EN UN MIDLEWARE PARA VALIDAR AUTENTICACION Y OTROS DATOS DE LA SESION*/
    if (!params.schema) {
      throw new Error("Schema must be specified on the API request");
    }

    /*CREATING MRP ENTRY IN THE MASTER TABLE*/
    // const [{ max_code: Code }] =
    //   await db.exec(`SELECT COALESCE(MAX(CAST ("Code" AS INTEGER)),0) + 1 AS "max_code"
    //                 FROM "${params.schema}"."${TABLE}"`);

    // const id = uuidv4();
    const detailData = data.detail;

    data.detail = null;

    const mrp = new Mrp({ ...data }, params);
    console.log(mrp);

    let statement = `INSERT INTO "${
      params.schema
    }"."${TABLE}"(${formatStamentStrings(
      Object.keys(mrp),
      "keys"
    )}) VALUES(${formatStamentStrings(Object.values(mrp), "values")});`;
    db.setAutoCommit(false);
    console.log(statement);

    await db.exec(statement);

    /*CREATING ENTRIES IN MRP_DETAIL */

    const [{ max_code: detailCode }] =
      await db.exec(`SELECT COALESCE(MAX(CAST ("Code" AS INTEGER)),0) + 1 AS "max_code"
                  FROM "${params.schema}"."${DETAIL_TABLE}"`);

    const detailStatement = detailData.map(
      (item, index) =>
        `INSERT INTO "${
          params.schema
        }"."${DETAIL_TABLE}" (\"Code\", \"Name\", \"U_mrp_id\", ${formatStamentStrings(
          Object.keys({ ...item }).map((item) =>
            converToPascalCase(item, true)
          ),
          "keys"
        )})
           VALUES(\'${detailCode + index}\' , \'${detailCode + index}\', \'${
          mrp.U_mrp_id
        }\', ${formatStamentStrings(Object.values(item), "values")});`
    );

    let counter = 0;
    for (let c of detailStatement) {
      console.log(c);
      await db.exec(c);
      console.log(counter + 1 + "of" + detailStatement.length);
      counter++;
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
    // data.Code = null;
    // data.Name = null;
    const detailData = data.detail;
    const insertData = data.newItems;

    delete data.detail;
    delete data.newItems;
    const mrp = new Mrp({ ...data }, { ...params, isUpdating: true });

    console.log(insertData);

    let statement = `UPDATE "${
      params.schema
    }"."${TABLE}" SET ${formatStamentStrings(
      Object.entries(mrp),
      "set"
    )} where "U_mrp_id" = '${params.mrpId}'`;
    console.log(statement);

    db.exec(statement);

    // PROCESING DETAIL

    //INSERT

    const [{ max_code: detailCode }] =
      await db.exec(`SELECT COALESCE(MAX(CAST ("Code" AS INTEGER)),0) + 1 AS "max_code"
                  FROM "${params.schema}"."${DETAIL_TABLE}"`);

    const insertStatement = insertData
      .map((item) => {
        delete item.isNewItem;
        return item;
      })
      .map(
        (item, index) =>
          `INSERT INTO "${
            params.schema
          }"."${DETAIL_TABLE}" (\"Code\", \"Name\", \"U_mrp_id\", ${formatStamentStrings(
            Object.keys({ ...item }).map((item) =>
              converToPascalCase(item, true)
            ),
            "keys"
          )})
           VALUES(\'${detailCode + index}\' , \'${detailCode + index}\', \'${
            params.mrpId
          }\', ${formatStamentStrings(Object.values(item), "values")});`
      );

    let counter = 0;
    for (let c of insertStatement) {
      await db.exec(c);
      console.log(
        "INSERTING...",
        counter + 1 + " of " + insertStatement.length
      );
      counter++;
    }
    console.log(insertStatement[0]);

    //UPDATE

    console.log(data.resetRefs);

    if (data.resetRefs) {
      const detailStatementZero = detailData
        .filter((_, index) => index == 0)
        .map(
          (item, index) =>
            `UPDATE "${params.schema}"."${DETAIL_TABLE}"
         SET \"U_order_amount\" = \'0\',
         \"U_price\" = \'0\',
         \"U_actual_price\" = \'0\',
         \"U_line_total\" = \'0\'
          WHERE "U_mrp_id" = '${params.mrpId}'`
        );

      console.log(detailStatementZero[0]);

      await db.exec(detailStatementZero[0]);
    }

    const detailStatement = detailData.map(
      (item, index) =>
        `UPDATE "${params.schema}"."${DETAIL_TABLE}"
         SET ${formatStamentStrings(
           Object.entries({ ...item, itemCode: null }).map(([key, val]) => [
             converToPascalCase(key, true),
             val,
           ]),
           "set"
         )} WHERE "U_mrp_id" = '${params.mrpId}'
          AND "U_item_code" = '${item.itemCode}'`
    );

    counter = 0;
    for (let c of detailStatement) {
      await db.exec(c);
      console.log(c);

      console.log("UPDATING...", counter + 1 + " of " + detailStatement.length);
      counter++;
    }

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
    const [{ U_status: currentStatus }] = db.exec(
      `SELECT "U_status" FROM "${params.schema}"."${TABLE}" WHERE "U_mrp_id" = '${params.mrpId}'`
    );
    console.log("##", currentStatus);

    // const detailStatement = `UPDATE "${params.schema}"."${DETAIL_TABLE}"
    // SET "U_status" = 'CANCELLED'
    // WHERE "U_mrp_id" = '${params.mrpId}'`;

    // db.exec(detailStatement);

    if (currentStatus == "OPENED") {
      const statement = `UPDATE "${params.schema}"."${TABLE}"
      SET "U_status" = 'CANCELED'
      WHERE "U_mrp_id" = '${params.mrpId}'`;
      db.exec(statement);
      return true;
    } else if (currentStatus == "CLOSED") {
      throw new Error("Este documento ya está cerrado y NO permite cambios");
    } else {
      return false;
    }
  } catch (error) {
    throw error;
  }
}

async function processPriceFile(queryParams) {
  try {
    const data = handleFileReading(queryParams.filepath);

    console.log(data);
    const keys = Object.keys(data[0]);

    const parsedData = data.map((item) => ({
      item_code: item[keys[0]],
      //description: item[keys[1]],
      //models: item[keys[2]],
      amount: item[keys[1]],
      price: item[keys[2]],
      line_total: parseFloat(item[keys[1]]) * parseFloat(item[keys[2]]),
    }));
    console.log(parsedData);

    return parsedData;
  } catch (error) {
    console.log(error);
  }
}

function handleFileReading(filePath) {
  const file = reader.readFile(filePath);

  const temp = reader.utils.sheet_to_json(file.Sheets[file.SheetNames[0]]);
  let data = [];
  temp.map((item) => {
    data.push(item);
  });

  return data;
}

function getDate() {
  //Date
  const date = new Date().getDate();
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const fullDate = `${year}${
    month.toString().length == 1 ? `${"0" + month}` : month
  }${date.toString().length == 1 ? `${"0" + date}` : date}`;

  return fullDate.toString();
}

module.exports = {
  TABLE,
  get,
  getNextMrpByBrand,
  create,
  update,
  remove,
  processPriceFile,
  getMrpDetailById,
};
