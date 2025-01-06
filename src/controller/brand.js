const { v4: uuidv4 } = require("uuid");
const { db } = require("../config/db");
const { converToPascalCase, formatStamentStrings } = require("../utils/string");
const TABLE = "@GA_BRAND";

const controller = {};

function Brand({ ...args }) {
  const resultingObject = {};
  let i = 0;
  for ([key, val] of Object.entries(args)) {
    if (val || val === 0) {
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

controller.create = async (params, data) => {
  try {
    const [{ max_code: Code }] =
      await db.exec(`SELECT COALESCE(MAX(CAST ("Code" AS INTEGER)),0) + 1 AS "max_code"
                    FROM "${params.schema}"."${TABLE}"`);

    const id = uuidv4();
    const brand = new Brand({
      Code,
      Name: Code,
      brandId: id,
      ...data,
    });

    const statement = `INSERT INTO "${
      params.schema
    }"."${TABLE}" (${formatStamentStrings(Object.keys(brand), "keys")})
    VALUES (
        ${formatStamentStrings(Object.values(brand), "values")}
    )`;

    console.log(statement);

    await db.exec(statement);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

controller.get = async (params) => {
  const data = db.exec(`SELECT * FROM "${params.schema}"."${TABLE}"`);

  const response = [];

  for (item of data) {
    //if (!response.some((sbItem) => sbItem.Code === item.Code)) {
    let isDetailField = false;
    let actualItem = {};
    //actualItem.detail = [];

    for ([key, value] of Object.entries(item)) {
      actualItem[key] = value;
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
};

controller.update = async (params, data) => {
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
    const brand = new Brand({ ...data });

    console.log(data);

    let statement = `UPDATE "${
      params.schema
    }"."${TABLE}" SET ${formatStamentStrings(
      Object.entries(brand),
      "set"
    )} where "Code" = ${params.code}`;
    console.log(statement);

    db.exec(statement);

    db.commit();
    return brand;
  } catch (error) {
    console.log(error);
    db.rollback();
    throw error;
  }
};

controller.remove = async (params) => {
  try {
    const statement = `DELETE FROM "${params.schema}"."${TABLE}" WHERE "Code" = ${params.code}`;
    console.log(statement);

    db.exec(statement);

    return true;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = controller;
