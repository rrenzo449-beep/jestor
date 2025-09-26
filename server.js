const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const pool = require('./db');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'tu_secreto_para_sesion',
  resave: false,
  saveUninitialized: false
}));

// Middleware para proteger rutas
function authMiddleware(req, res, next) {
  if(req.session.userId){
    next();
  } else {
    res.redirect('/login.html');
  }
}

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if(rows.length === 0) {
      return res.redirect('/login.html?error=1');
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if(match){
      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect('/tasks.html');
    } else {
      res.redirect('/login.html?error=1');
    }
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// API para tareas
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE user_id = ?', [req.session.userId]);
    res.json(tasks.map(t => t.task_text));
  } catch (e) {
    res.status(500).json({ error: 'Error fetching tasks' });
  }
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  const { task } = req.body;
  if(!task || task.trim() === '') return res.status(400).json({ error: 'Task is required' });

  try {
    await pool.query('INSERT INTO tasks (user_id, task_text) VALUES (?, ?)', [req.session.userId, task]);
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: 'Error adding task' });
  }
});

app.delete('/api/tasks/:index', authMiddleware, async (req, res) => {
  const index = parseInt(req.params.index);
  try {
    // Obtener tareas ordenadas para el usuario
    const [tasks] = await pool.query('SELECT id FROM tasks WHERE user_id = ? ORDER BY created_at', [req.session.userId]);
    if(index < 0 || index >= tasks.length) return res.status(400).json({ error: 'Invalid index' });
    
    const taskId = tasks[index].id;
    await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: 'Error deleting task' });
  }
});

// Servir archivos estáticos (html, css, js)
const path = require("path");
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.redirect("/login.html");
});


const PORT = 3000;
// Registro de usuario
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send("Missing fields");
  }

  try {
    // Verificar si el usuario ya existe
    const [existing] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length > 0) {
      return res.redirect("/register.html?error=exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (username, password) VALUES (?, ?)", [
      username,
      hashedPassword,
    ]);

    res.redirect("/login.html?registered=1");
  } catch (e) {
    console.error(e);
    res.status(500).send("Error registering user");
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
