const express = require("express");
const routes = require("./routes");
const bodyParser = require("body-parser");
const cors = require("cors");
function config(app) {
  app.set("port", process.env.GA_MRP_PORT || 3001);

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const corsOptions = {
    credentials: true,
    origin: "*",
  };

  app.use(cors(corsOptions));

  routes(app);

  return app;
}

module.exports = config;
