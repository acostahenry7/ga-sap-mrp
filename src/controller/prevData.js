const { db } = require("../config/db");
const _ = require("lodash");

async function getBrandList() {
  try {
    await db.exec(`SET SCHEMA DB_AA_TEST; `);
    let brands =
      await db.exec(`SELECT T0."PrcCode" as "brand_code", T0."PrcName" as "brand" 
                                        FROM OPRC T0 
                                        WHERE T0."DimCode" = 3  
                                        AND T0."Active" = 'Y' 
                                        ORDER BY T0."PrcName"`);

    return brands;
  } catch (error) {
    console.log(error);
  }
}

async function getStockSummary(params) {
  const actualMonth = parseInt(params.month);

  let monthFrom = actualMonth;
  let monthTo = actualMonth - 1 == 0 ? 12 : actualMonth - 1;
  let months = [];

  let yearTo =
    actualMonth - 1 == 0 ? parseInt(params.year) - 1 : parseInt(params.year);

  for (let i = 0; i < 12; i++) {
    if (monthFrom == 0) {
      monthFrom = 12;
    }
    monthFrom -= 1;

    if (i == 11 && monthFrom == 0) {
      monthFrom = 12;
    }
  }

  let monthNumber = monthFrom;
  for (let i = monthFrom; i < monthFrom + 12; i++) {
    if (monthNumber > 12) {
      monthNumber = 1;
    }
    months.push(monthNumber);

    monthNumber++;
  }
  console.log(months);

  try {
    const statement = `SELECT 
    "company" ,
    "brand", 
    "brand_code",
    "item_code",
    "factory_item_code",
    "description",
    "model",
    "last_purchase_price",
    "rate",
    "fob",  
    "currency",      
    "inv_transit",
    "inv_stock",
    --"InvCpm",
    "inv_avg_price",
    "year", 
    "month",
    "sales",
    sum("sales") over (partition by "item_code") as "total_sales_per_item"
    FROM (
    SELECT
    'LM' AS "company" ,
    T0."U_GB_Marca" AS "brand", 
    T0."U_OcrCode3" AS "brand_code",
    T0."ItemCode" AS "item_code",
    T0."U_GB_OldItemCode" as "factory_item_code",
    T0."ItemName" AS "description",
    COALESCE("U_GB_VehicleModel",'') ||  ' (' ||COALESCE("U_GB_VehicleYear",'') || ')' AS "model", 
    T0."OnHand" AS "Existencia",
    T0."LastPurPrc" AS "last_purchase_price",
    T5."Rate"  AS "rate",
    COALESCE(T9."FOB", T10."FOB",T0."LastPurPrc") as "fob",
    COALESCE(T9."Currency", T10."Currency",'') as "currency",
    COALESCE(T1."InvQty",0) AS "inv_stock",
    --COALESCE(T1."InvCpm",0) AS "InvCpm",
    COALESCE(T1."InvAvgPrice",0) AS "inv_avg_price",
    COALESCE(T4."Pedido",0) + COALESCE(T7."FacturaProveedor",0) as "inv_transit",
    T2."Year" as "year", 
    T2."Month" as "month",
    COALESCE(T3."SalesQty",0) as "sales"
    FROM "OITM" T0 
        INNER JOIN "OITB" T6 ON (T6."ItmsGrpCod" = T0."ItmsGrpCod") 
        LEFT JOIN "ORTT" T5 ON (T5."RateDate" = CURRENT_DATE AND T5."Currency" = 'USD')
        left JOIN (
                  SELECT TA."ItemCode" "ItemCode", SUM(TA."IsCommited") "InvCpm",SUM(TA."OnHand") "InvQty", SUM("AvgPrice" * TA."OnHand") as "InvAvgPrice"
                    FROM "OITW" TA                  
                    WHERE TA."OnHand" > 0 
                      AND LEFT(TA."WhsCode",3) NOT IN('TRP', 'TPI', 'TSU', 'TRE', 'TSP', 'TPP', 'TAC', 'TAP', 'SMI', 
                  'NOR','MSC', 'TVR', 'TVP', 'DIF', 'AVE', 'REC', 'SMG')
                    GROUP BY TA."ItemCode"
              ) T1 ON T0."ItemCode" = T1."ItemCode"  



      LEFT JOIN (SELECT EM."ItemCode" as "ItemCode", EM."Currency" AS "Currency", (EM."PriceFOB") AS "FOB"  FROM
        ( SELECT  MM."ItemCode", MAX(MM."DocEntry") "DocEntry", MAX(MM."LineNum") as "LineNum"
          FROM "IPF1" MM WHERE 1= 1  
          GROUP BY MM."ItemCode") MM 
        INNER JOIN "OIPF" MO ON MM."DocEntry" = MO."DocEntry"
        INNER JOIN "IPF1" EM ON MM."ItemCode" = EM."ItemCode" AND EM."DocEntry" = MM."DocEntry"  and EM."LineNum" = MM."LineNum") T9 ON T9."ItemCode" = T0."ItemCode"  
      
      LEFT JOIN (SELECT EM."ItemCode" as "ItemCode", EM."Currency" AS "Currency", (EM."Price") AS "FOB"  FROM
        ( SELECT  MM."ItemCode", MAX(MM."DocEntry") "DocEntry", MAX(MM."LineNum") as "LineNum"
          FROM "POR1" MM WHERE 1= 1  
          GROUP BY MM."ItemCode") MM 
        INNER JOIN "OPOR" MO ON MM."DocEntry" = MO."DocEntry"
        INNER JOIN "POR1" EM ON MM."ItemCode" = EM."ItemCode" AND EM."DocEntry" = MM."DocEntry"  and EM."LineNum" = MM."LineNum") T10 ON T10."ItemCode" = T0."ItemCode" 
      



        left JOIN (
                    SELECT "YEAR" "Year", "MONTH" "Month"
                      FROM "_SYS_BI"."M_TIME_DIMENSION" 
                    WHERE "YEAR" BETWEEN 2017 AND YEAR(CURRENT_DATE)
                    GROUP BY "YEAR", "MONTH" ORDER BY "YEAR", "MONTH"  
              ) T2 ON 1 = 1
        
      left JOIN (
    SELECT  
    "ItemCode", "SalesYear",  "SalesMonth", SUM("SalesQty") "SalesQty"
    FROM (
                  SELECT TB."ItemCode" "ItemCode", 
                                  YEAR(TA."DocDate") "SalesYear",
                                  MONTH(TA."DocDate") "SalesMonth", SUM(TB."Quantity") "SalesQty"
                    FROM "OINV" TA
                    INNER JOIN "INV1" TB ON TA."DocEntry" = TB."DocEntry"
                    WHERE 1 =1 
                      AND TA."CANCELED" = 'N'
                        AND YEAR(TA."DocDate") > 2016
                    GROUP BY TB."ItemCode",  YEAR(TA."DocDate"), MONTH(TA."DocDate")
    UNION ALL
    SELECT TB."ItemCode" "ItemCode", 
                                  YEAR(TA."DocDate") "SalesYear",
                                  MONTH(TA."DocDate") "SalesMonth", 
                                  SUM(TB."Quantity") "SalesQty"
                    FROM "OIGE" TA
                    INNER JOIN "IGE1" TB ON TA."DocEntry" = TB."DocEntry"
                    WHERE 1 =1 
                      AND TA."CANCELED" = 'N'
                  AND YEAR(TA."DocDate") > 2016
                    GROUP BY TB."ItemCode",  YEAR(TA."DocDate"), MONTH(TA."DocDate")

      UNION ALL
                      SELECT TB."ItemCode" "ItemCode", 
                                  YEAR(TA."DocDate") "SalesYear",
                                  MONTH(TA."DocDate") "SalesMonth", SUM((TB."Quantity")*-1) "SalesQty"
                    FROM "ORIN" TA
                    INNER JOIN "RIN1" TB ON TA."DocEntry" = TB."DocEntry"
                    WHERE 1 =1 
                      AND TA."CANCELED" = 'N'
                        AND YEAR(TA."DocDate") > 2016
                    GROUP BY TB."ItemCode",  YEAR(TA."DocDate"), MONTH(TA."DocDate")
    ) 
                    GROUP BY "ItemCode",  "SalesYear","SalesMonth"

        ) T3 ON T0."ItemCode" = T3."ItemCode" AND T2."Year" = T3."SalesYear" AND T2."Month" = T3."SalesMonth" 
      LEFT JOIN (
                  SELECT TB."ItemCode" "ItemCode", 
                          SUM(TB."Quantity") AS "Pedido"
                    FROM "OPOR" TA INNER JOIN "POR1" TB ON TA."DocEntry" = TB."DocEntry"
                    WHERE 1 =1  AND TA."CANCELED" = 'N' AND TA."DocStatus" <> 'C'  AND TB."LineStatus" <> 'C' GROUP BY TB."ItemCode"
        ) T4 ON T0."ItemCode" = T4."ItemCode"
           LEFT JOIN (
                  SELECT TB."ItemCode" "ItemCode",
                          SUM(TB."Quantity") AS "FacturaProveedor"
                    FROM "OPCH" TA INNER JOIN "PCH1" TB ON TA."DocEntry" = TB."DocEntry"
                    WHERE 1 =1  AND TA."DocType"='I' AND TA."isIns" = 'Y' AND TA."CANCELED" = 'N' AND TA."DocStatus" <> 'C'  AND TB."LineStatus" <> 'C' GROUP BY TB."ItemCode"
        ) T7 ON T0."ItemCode" = T7."ItemCode" 
      
    WHERE 1 = 1 

    AND T0."validFor" = 'Y'
    AND T0."QryGroup8" = 'N' 
    AND T0."QryGroup10" = 'N'
    AND T0."PrchseItem" = 'Y'
    AND T0."InvntItem" = 'Y'
    ) TB
    WHERE (("year" = '${
      parseInt(params.year) - 1
    }' AND to_int("month") >= ${monthFrom}) OR ("year" = '${yearTo}' AND to_int("month") <= ${monthTo}))
    AND "brand" like '${params.brand || "%"}'
    order by "total_sales_per_item" desc, "item_code",  "year" desc, "month" desc
    --LIMIT 10000`;

    db.exec(`SET SCHEMA ${params?.schema || "DB_LM"}`);
    console.log(statement);

    const res = db.exec(statement);

    const result = groupDataByMonth(res, params);

    return { ...result, months };
  } catch (error) {
    console.log(error);
  }
}

async function getProviders(params) {
  try {
    const statement = `SELECT "CardCode", "CardName", "Currency" FROM "${params.schema}"."OCRD" WHERE "CardType" = 'S'`;
    const res = db.exec(statement);

    return res;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
async function getCurrencies(params) {
  try {
    const statement = `	SELECT "CurrCode", "CurrName", "DocCurrCod" FROM "${params.schema}"."OCRN" `;
    const res = db.exec(statement);

    return res;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

module.exports = {
  getBrandList,
  getStockSummary,
  getProviders,
  getCurrencies,
};

function groupDataByMonth(data, queryParams) {
  let groupedData = [];

  for (item of data) {
    let itemExists = groupedData.find((e) => e.item_code == item.item_code);
    if (itemExists) {
      let index = groupedData.findIndex(
        (e) => e.item_code == itemExists.item_code
      );
      groupedData[index].amounts.push(parseFloat(item.sales));
    } else {
      groupedData.push({ ...item, amounts: [parseFloat(item.sales)] });
    }
  }

  groupedData = groupedData.map((item) => ({
    ...item,
    amounts: item.amounts.reverse(),
  }));

  // console.log(groupedData);

  return { groupedData };

  // let groupedData = [];

  // let startingMonth = 1; // parseInt(queryParams.dateFrom.split("-")[1]);
  // let endingMonth = 12; //parseInt(queryParams.dateTo.split("-")[1]);
  // let gridMonths = Math.abs(endingMonth + 1 - startingMonth);

  // for (let item of data) {
  //   let itemAmounts = data
  //     .filter((sItem) => sItem["item_code"] == item["item_code"])
  //     .map((i) => ({
  //       amount: parseInt(i["sales"]),
  //       month: parseInt(i["month"]),
  //     }));

  //   console.log(itemAmounts);

  //   if (
  //     !groupedData.some(
  //       (groupedItem) => groupedItem["item_code"] == item["item_code"]
  //     )
  //   ) {
  //     let gridAmounts = Array(gridMonths).fill(0);

  //     for (let i = 0; i < gridAmounts.length; i++) {
  //       endingMonth -= 1;
  //       if (itemAmounts[i]?.month) {
  //         gridAmounts[endingMonth] = itemAmounts[i].amount;
  //       }
  //     }

  //     groupedData.push({
  //       ...item,
  //       order_amount: 0,
  //       amounts: gridAmounts,
  //     });
  //   }
  // }

  // return {
  //   groupedData,
  //   months: getMonthNamesByRange(startingMonth, endingMonth),
  //   nextMonths: getMonthNamesByRange(endingMonth + 1, endingMonth + gridMonths),
  //   gridMonths,
  //   startingMonth,
  // };
}

function getMonthNamesByRange(start, end) {
  start -= 1;

  let monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  let targetMonthNames = [];

  // if (start >= 12) {
  //   start = start - 12;
  // }
  let index = start;
  for (let i = start; i < end; i++) {
    if (monthNames[index] == null || monthNames[index] == undefined) {
      index = 0;
    }
    targetMonthNames.push(monthNames[index]);
    index++;
  }

  return targetMonthNames;
}
