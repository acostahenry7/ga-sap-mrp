const hanaClient = require("@sap/hana-client");
const connection = hanaClient.createConnection();
const defaultConnectionParams = {
  serverNode: "gaophana:30015",
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
