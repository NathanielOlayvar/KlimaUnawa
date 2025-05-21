const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const session = require('express-session');
const deleteAccountRoute = require('./routes/DeleteAccount');
const Users = require('./models/Users.js');
const TemperatureData = require('./models/TemperatureData.js');

dotenv.config();

const app = express();

//====================================
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server);
//==================================

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(morgan('dev'));

//Convert data into JSON format (Middleware)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

//Session Middleware
app.use(session({secret: 'yourSecretKey', resave: false, saveUninitialized: false}));
app.use(async (req, res, next) => {
  if (req.session.userId) {
    res.locals.user = await Users.findById(req.session.userId).lean();
  } else {
    res.locals.user = null;
  }
  next();
});

app.use('/DeleteAccount', deleteAccountRoute);

//Logs the incoming data from Arduino (form POST and IP)--------------------------
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  //console.log('Headers:', req.headers); This logs the print request when switching URLs and Headers

  // Optional: log body if it's a POST
  if (req.method === 'POST') {
    console.log('Body:', req.body);
  }
  next();
});
//--------------------------------------------------------------

//view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get("/", (req, res) => {
  res.render("login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/Homepage", (req, res) => {
  res.render("Homepage");
});

app.get("/Appendix", (req, res) => {
  res.render("Appendix");
});

//Get latest temp
async function addDefaultTemperatureData() {
  try {
    const dataExists = await TemperatureData.findOne();
    if (!dataExists) {
      const defaultData = new TemperatureData({ temperature: 0, humidity: 0, heat_index: 0 });
      await defaultData.save();
      console.log('Default temperature and humidity data added');
    }
  } catch (error) {
    console.error('Error adding default data:', error);
  }
}


// Get Temp (Dashboard)
app.get('/Dashboard', async (req, res) => {
  try {
    // Fetch the latest temperature and humidity data from MongoDB
    const latestData = await TemperatureData.findOne().sort({ _id: -1 });

    if (!latestData) {
      return res.render('Dashboard', { temperature: 'N/A', humidity: 'N/A', heat_index: 'N/A' });
    }

    // Render the dashboard with the latest data
    res.render('Dashboard', {
      temperature: latestData.temperature,
      humidity: latestData.humidity,
      heat_index: latestData.heat_index
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching temperature data.');
  }
});

//======================================
// WebSocket logic
io.on('connection', (socket) => {

  console.log('Client connected');

  // Send initial data
  TemperatureData.find().sort({ timestamp: -1 }).limit(100).then(data => {
    socket.emit('data-update', data);
  });

  // Watch for real-time DB changes
  const changeStream = TemperatureData.watch();
  changeStream.on('change', async (change) => {
    console.log("Change detected:", change); // 🔍 Log to check if it runs

    if (change.operationType === 'insert') {
      const newDoc = change.fullDocument;
      console.log("New document inserted:", newDoc); // 🔍 Check doc structure  

      socket.emit('data-update', [newDoc]);
    }
  });
});
//=======================================

//POST request each user registration
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password, ['confirm-password']: confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).send("All fields are required.");
    }

    if (password !== confirmPassword) {
      return res.status(400).send("Passwords do not match.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new Users({
      name: username,
      email: email,
      password: hashedPassword
    });

    await newUser.save();
    console.log("User saved:", newUser);

    res.redirect('/');
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).send("Signup failed. Either the username or email already exist.");
  }
});

//POST request each user login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Validate the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Save user session
    req.session.userId = user._id;

    // Successful login response
    res.status(200).json({ message: "Login successful", redirect: "/Homepage" });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "An error occurred during login." });
  }
});



//POST request for temperature through arduino
app.post('/dashboard', async (req, res) => {
  const { nodeId, temperature, humidity, heat_index } = req.body;

  if (!nodeId || temperature == null || humidity == null || heat_index == null) {
    return res.status(400).send('Missing nodeId, temperature, humidity, or heat index');
  }

  try {
    const newEntry = new TemperatureData({
      temperature,
      humidity,
      heat_index,
      timestamp: new Date() // optional: use Date.now()
    });
    await newEntry.save();
    console.log("Data received", newEntry);
  } catch (err) {
    console.error('Error saving to Database:', err);
    res.status(500).send('Server error');
  }
});

module.exports = app;

//Connect to MongoDB 
async function connect() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    // Initialize with default temperature data if collection is empty
    const count = await TemperatureData.countDocuments();
    if (count === 0) {
      await TemperatureData.create({ temperature: 0, humidity: 0, heat_index: 0 });
      console.log("Initialized temperature data with default values.");
    }

  } catch (error) {
    console.log(error);
  }
}

connect();

const port = 8000;
server.listen(port, () => {
  console.log(`App running on Port: ${port}`);
});