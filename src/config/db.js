const hanaClient = require("@sap/hana-client");
const connection = hanaClient.createConnection();
const hostname = process.env.PROD_DB_HOST || "10.1.100.146";
const defaultConnectionParams = {
  serverNode: `${hostname}:30015`,
  UID: "B1ADMIN",
  PWD: "MC6vsaGz",
  sslValidateCertificate: "false",
};

function createHanaConnection(params) {
  if (!params) params = defaultConnectionParams;

  connection.connect(params);
}

module.exports = {
  createHanaConnection,
  db: connection,
};
