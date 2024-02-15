const config = require("config");
const express = require("express");
const app = express();

require('./startup/cors')(app)
require("./startup/routes")(app);

const port = process.env.PORT || config.get("port");
const server = app.listen(port, () =>
  console.log(`Listening on port ${port}...`)
);

module.exports = server;
