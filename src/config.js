const express = require("express");
const routes = require("./routes");
const bodyParser = require("body-parser");
const cors = require("cors");
function config(app) {
  app.set("port", process.env.GA_MRP_PORT || 3001);

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: "50mb" }));

  //app.use(express.json({ limit: "50mb" }));
  // app.use(express.urlencoded({ limit: "200mb", extended: true }));

  const corsOptions = {
    origin: "*",
  };

  app.use(cors(corsOptions));

  routes(app);

  return app;
}

module.exports = config;
