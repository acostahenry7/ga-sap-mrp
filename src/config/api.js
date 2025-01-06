module.exports = {
  url: {
    auth:
      process.env.NODE_ENV == "production"
        ? "http://unixapi.grupoavant.com.do:6004"
        : "http://localhost:3002/api/auth",
  },
};
