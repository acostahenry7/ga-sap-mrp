const express = require("express");
const config = require("./config");
const app = config(express());
const { createHanaConnection } = require("./config/db");

app.listen(app.get("port"), () => {
  console.log(`APP listening on port ${app.get("port")}`);
  try {
    console.log("Trying to connect to DB");
    createHanaConnection();
    console.log("DB Connected");
  } catch (error) {
    console.log(error.message);
  }
});
