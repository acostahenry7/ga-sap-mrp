function converToPascalCase(str) {
  let result = "";

  let i = 0;
  for (c of str) {
    if (c == c.toUpperCase() && i != 0) {
      result += "_" + c.toLowerCase();
    } else {
      result += c;
    }
    i++;
  }

  return result;
}

function formatStamentStrings(values, type, table) {
  let result = "";

  switch (type) {
    case "values":
      result = values
        .map((val) => (typeof val == "string" ? ` \'${val}\'` : val))
        .join(",");
      break;
    case "keys":
      result = values.map((val) => ` \"${val}\"`).join(",");
      break;
    case "set":
      result = values
        .map(([key, val]) =>
          typeof val == "string"
            ? ` \"${key}\" = \'${val}\' `
            : `\"${key}\" = ${val}`
        )
        .join(",");
      break;
    case "where":
      result = values
        .map(([key, val], index) => {
          let suffix = "";
          if (index == 0) {
            suffix = "WHERE";
          } else {
            suffix = "AND";
          }

          console.log(values);

          return typeof val == "string"
            ? `${suffix} \"${table}\".\"${key}\" LIKE \'${val}%\' `
            : `${suffix} \"${table}\".\"${key}\" = ${val}`;
        })
        .join(" ");
      break;
    default:
      break;
  }

  return result;

  // \'${data._SCGD_VEHICULO_U_Num_VIN}\'
}

module.exports = {
  converToPascalCase,
  formatStamentStrings,
};
