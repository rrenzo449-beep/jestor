const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root", // ejemplo: 'root'
  password: "", // si no tienes password, deja ''
  database: "task_manager",
});

module.exports = pool;
