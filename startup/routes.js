const express = require("express");
const citizens = require("../routes/citizens");
const militaries = require("../routes/militaries");
const records = require("../routes/records");
const users = require("../routes/users");
const departments = require("../routes/departments");
const auth = require("../routes/auth");
const concurrent = require("../routes/checkConcurrent");

module.exports = function (app) {
  app.use(express.json());
  app.use("/api/citizens", citizens);
  app.use("/api/militaries", militaries);
  app.use("/api/records", records);
  app.use("/api/users", users);
  app.use("/api/departments", departments);
  app.use("/api/auth", auth);
  app.use("/api/test-concurrent", concurrent);
};
