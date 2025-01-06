const axios = require("axios");
const server = require("../config/api");

async function login(loginData) {
  try {
    const session = await axios.post(`${server.url.auth}/login`, loginData);

    return session.data;
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  login,
};
