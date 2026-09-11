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

async function getModelList(params) {
  try {
    let brands = await db.exec(
      `select DISTINCT("U_GB_VehicleModel") AS "model"
      from "${params.schema}"."OITM" 
      WHERE "U_GB_VehicleModel" IS NOT NULL
      AND "U_OcrCode3" LIKE '${params.brandCode || "%"}'
      ORDER BY "U_GB_VehicleModel"`,
    );

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
  console.log("###########@", params.models?.length);

  try {
    const statement = `-- =====================================================================================
-- INVENTORY / SALES REPORT BY ITEM, MONTH, BRAND
-- Company: LM
-- Purpose: For each item, shows monthly sales history alongside current stock,
--          in-transit (open PO) quantity, pricing (FOB/local), and a running
--          total of sales per item across the whole reporting window.
-- =====================================================================================

SELECT 
    "company" ,
    "brand", 
    "brand_code",
    "item_code",
    "factory_item_code",
    "description",
    "factory_description",
    "filter_model",
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
    -- Running total of sales per item across the entire filtered date range,
    -- repeated on every row for that item (used for sorting "best sellers" first)
    sum("sales") over (partition by "item_code") as "total_sales_per_item"
    FROM (
    SELECT
    'LM' AS "company" ,
    T0."U_GB_Marca" AS "brand", 
    T0."U_OcrCode3" AS "brand_code",
    T0."ItemCode" AS "item_code",
    T0."U_GB_OldItemCode" as "factory_item_code",
    T0."ItemName" AS "description",
    T0."FrgnName" AS "factory_description",

    -- Human-readable vehicle model + year, e.g. "Civic (2020)"
    COALESCE("U_GB_VehicleModel",'') ||  ' (' ||COALESCE("U_GB_VehicleYear",'') || ')' AS "model", 
    "U_GB_VehicleModel" AS "filter_model",  -- raw model, for filtering without the year suffix

    T0."OnHand" AS "Existencia",            -- item master's own on-hand snapshot (not warehouse-filtered)
    T0."LastPurPrc" AS "last_purchase_price",

    T5."Rate"  AS "rate",                   -- today's USD exchange rate

    -- FOB price: prefer factory price list (T9), fall back to purchase quote (T10),
    -- fall back to last purchase price if neither exists
    COALESCE(T9."FOB", T10."FOB",T0."LastPurPrc") as "fob",
    COALESCE(T9."Currency", T10."Currency",'') as "currency",

    -- On-hand stock, excluding transit/consignment/other non-sellable warehouses (see T1 filter)
    COALESCE(T1."InvQty",0) AS "inv_stock",
    --COALESCE(T1."InvCpm",0) AS "InvCpm",
    COALESCE(T1."InvAvgPrice",0) AS "inv_avg_price",

    -- In-transit quantity = still-open PO quantity (ordered minus already received).
    -- NOTE: previously this also added AP-invoice quantity (via a "T7" join on OPCH/PCH1),
    -- but that double-counted stock: an invoice with isIns='Y' posts its own goods receipt
    -- the moment it's added, regardless of DocStatus (DocStatus only reflects payment status,
    -- not receipt status). So those units were already in OITW.OnHand / "inv_stock" above,
    -- and adding them again here inflated in-transit. That join has been removed.
    COALESCE(T4."Pedido",0) as "inv_transit",

    T2."Year" as "year", 
    T2."Month" as "month",
    COALESCE(T3."SalesQty",0) as "sales"

    FROM "OITM" T0 
        INNER JOIN "OITB" T6 ON (T6."ItmsGrpCod" = T0."ItmsGrpCod")   -- Item group (used only as a filter gate via T0 fields, not selected)

        -- Today's USD exchange rate
        LEFT JOIN "ORTT" T5 ON (T5."RateDate" = CURRENT_DATE AND T5."Currency" = 'USD')

        -- On-hand stock per item, summed across sellable warehouses only
        -- (excludes transit/consignment/damaged/etc. warehouse codes)
        left JOIN (
                  SELECT TA."ItemCode" "ItemCode", SUM(TA."IsCommited") "InvCpm",SUM(TA."OnHand") "InvQty", SUM("AvgPrice" * TA."OnHand") as "InvAvgPrice"
                    FROM "OITW" TA                  
                    WHERE TA."OnHand" > 0 
                      AND LEFT(TA."WhsCode",3) NOT IN('TRP', 'TPI', 'TSU', 'TRE', 'TSP', 'TPP', 'TAC', 'TAP', 'SMI', 
                  'NOR','MSC', 'TVR', 'TVP', 'DIF', 'AVE', 'REC', 'SMG')
                    GROUP BY TA."ItemCode"
              ) T1 ON T0."ItemCode" = T1."ItemCode"  

      -- Latest FOB price from the factory price list (IPF1/OIPF), per item's most recent line
      LEFT JOIN (SELECT EM."ItemCode" as "ItemCode", EM."Currency" AS "Currency", (EM."PriceFOB") AS "FOB"  FROM
        ( SELECT  MM."ItemCode", MAX(MM."DocEntry") "DocEntry", MAX(MM."LineNum") as "LineNum"
          FROM "IPF1" MM WHERE 1= 1  
          GROUP BY MM."ItemCode") MM 
        INNER JOIN "OIPF" MO ON MM."DocEntry" = MO."DocEntry"
        INNER JOIN "IPF1" EM ON MM."ItemCode" = EM."ItemCode" AND EM."DocEntry" = MM."DocEntry"  and EM."LineNum" = MM."LineNum") T9 ON T9."ItemCode" = T0."ItemCode"  
      
      -- Fallback FOB price from the latest purchase quotation (POR1/OPOR), per item's most recent line
      LEFT JOIN (SELECT EM."ItemCode" as "ItemCode", EM."Currency" AS "Currency", (EM."Price") AS "FOB"  FROM
        ( SELECT  MM."ItemCode", MAX(MM."DocEntry") "DocEntry", MAX(MM."LineNum") as "LineNum"
          FROM "POR1" MM WHERE 1= 1  
          GROUP BY MM."ItemCode") MM 
        INNER JOIN "OPOR" MO ON MM."DocEntry" = MO."DocEntry"
        INNER JOIN "POR1" EM ON MM."ItemCode" = EM."ItemCode" AND EM."DocEntry" = MM."DocEntry"  and EM."LineNum" = MM."LineNum") T10 ON T10."ItemCode" = T0."ItemCode" 

        -- Calendar dimension: one row per Year/Month from 2017 to current year,
        -- cross-joined (1=1) so every item gets a row for every month in range
        left JOIN (
                    SELECT "YEAR" "Year", "MONTH" "Month"
                      FROM "_SYS_BI"."M_TIME_DIMENSION" 
                    WHERE "YEAR" BETWEEN 2017 AND YEAR(CURRENT_DATE)
                    GROUP BY "YEAR", "MONTH" ORDER BY "YEAR", "MONTH"  
              ) T2 ON 1 = 1
        
      -- Monthly sales quantity per item, net of: A/R invoices (OINV) + inventory goods
      -- issues under specific movement codes (OIGE, e.g. samples/consumption) - A/R
      -- credit memos / returns (ORIN, subtracted)
      left JOIN (
    SELECT  
    "ItemCode", "SalesYear",  "SalesMonth", SUM("SalesQty") "SalesQty"
    FROM (
                  -- A/R Invoices (positive sales)
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
    -- Inventory Goods Issues under specific expense/consumption codes (treated as "sales" too)
    SELECT TB."ItemCode" "ItemCode", 
                                  YEAR(TA."DocDate") "SalesYear",
                                  MONTH(TA."DocDate") "SalesMonth", 
                                  SUM(TB."Quantity") "SalesQty"
                    FROM "OIGE" TA
                    INNER JOIN "IGE1" TB ON TA."DocEntry" = TB."DocEntry"
                    WHERE 1 =1 
                      AND TA."CANCELED" = 'N'
                  AND YEAR(TA."DocDate") > 2016
                  AND TA."U_GB_Concepto" in('62070304', '62070305')
                    GROUP BY TB."ItemCode",  YEAR(TA."DocDate"), MONTH(TA."DocDate")

      UNION ALL
      -- A/R Credit Memos / Returns (negative sales, subtracted from the total)
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

      -- Open Purchase Order quantity per item = truly "in transit" (ordered, not yet received).
      -- Uses OpenQty (not Quantity) so partially-received lines only contribute the
      -- remaining un-received portion, not the full original order quantity.
      LEFT JOIN (
                  SELECT TB."ItemCode" "ItemCode", 
                          SUM(TB."OpenQty") AS "Pedido"
                    FROM "OPOR" TA INNER JOIN "POR1" TB ON TA."DocEntry" = TB."DocEntry"
                    WHERE 1 =1  AND TA."CANCELED" = 'N' AND TA."DocStatus" <> 'C'  AND TB."LineStatus" <> 'C' GROUP BY TB."ItemCode"
        ) T4 ON T0."ItemCode" = T4."ItemCode"

    WHERE 1 = 1 
    AND T0."validFor" = 'Y'        -- item is active
    AND T0."QryGroup8" = 'N'       -- excludes items flagged under query group 8 (e.g. discontinued/blocked)
    AND T0."QryGroup10" = 'N'      -- excludes items flagged under query group 10
    AND T0."PrchseItem" = 'Y'      -- item is purchasable
    AND T0."InvntItem" = 'Y'       -- item is an inventory item
    ) TB
    -- Reporting window: dynamic, driven by the app's year/month params
    WHERE (("year" = '${
      parseInt(params.year) - 1
    }' AND to_int("month") >= ${monthFrom}) OR ("year" = '${yearTo}' AND to_int("month") <= ${monthTo}))
    AND "brand_code" like '${params.brand || "%"}'
    ${
      params.models?.length > 0
        ? `AND "filter_model" in (${params.models
            ?.split(",")
            .map((item) => `'${item}'`)
            .join(",")})`
        : ""
    }
    order by "model"desc, "total_sales_per_item" desc, "item_code",  "year" desc, "month" desc`;

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
  getModelList,
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
        (e) => e.item_code == itemExists.item_code,
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
