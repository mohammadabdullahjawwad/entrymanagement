var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mongoose = require("mongoose");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var Visitor = require("./models/visitor");
var User = require("./models/user");
var methodOverride = require("method-override");

app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.urlencoded({extended: true}));

require('dotenv').config(); // For storing the email and password of the 

// Local Time that has to be displayed
var indiaTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
indiaTime = new Date(indiaTime);

// Opening lines of the messages to be sent to the Host and Visitor respectively
var messageHost = "Hi, someone just checked in. The important details are as follows :";
var messageVisitor = "Hi, you just checked out. Thanks for visiting us! The important details are as follows :";

// Requiring nodemailer and nexmo - used for sending Email and SMS respectively
const nodemailer = require("nodemailer");
const Nexmo = require("nexmo");

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD
  }
});

mongoose.connect("mongodb://localhost:27017/entry_management", { useNewUrlParser: true, useUnifiedTopology: true });
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

app.use(require("express-session")({
  secret: "Hidden secrets unleashed!",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const http = require('http');
const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.end();
});

// For tracking the Username of the Host
app.use(function(req, res, next){
  res.locals.currentUser = req.user;
  if(req.user) {
    req.username = req.user.username;
  }
  next();
});

// Landing Page
app.get("/", function(req, res) {
    res.render("landing");
});

// INDEX - Show all visitors
app.get("/visitors", isLoggedIn, function(req, res) {
  Visitor.find({}, function(err, allVisitors) {
    if(err) {
      console.log(err);
    } else {
      res.render("index", {visitors: allVisitors, currentUser: req.user});
    }
  });
});

// CREATE - Add new visitors to DB
app.post("/visitors", isLoggedIn, hostDetails, function(req, res) {
  var name = req.body.name;
  var email = req.body.email;
  var phone = req.body.phone;
  var checkIn = indiaTime.toLocaleString();
  var address = req.body.address;
  var newVisitor = {name: name, email: email, phone: phone, checkIn: checkIn, address: address}
  Visitor.create(newVisitor, function(err, newVisitor) {
    if(err) {
      console.log(err);
    } else {
      res.redirect("/visitors");
      const mailOptions = {
        from: process.env.EMAIL, // Sender Email
        to: req.user.email, // Receiver Email
        subject: 'New Check In', // Subject Line
        text: `${messageHost}\n\n\n\n\n Name - ${name}\n Email - ${email}\n Phone - ${phone}\n Check In Time - ${checkIn}\n`  // Body of Email
      };
      console.log(mailOptions)
      console.log(transporter)
      // Sending Email to Host when a Visitor checks In
      transporter.sendMail(mailOptions, function (err, info) {
        if(err) {
          console.log("Error Occurred")
          console.log(err)
        } else {
          console.log("Email sent successfully to the Host!!")
          console.log(info);
        }
      });
      // Sending SMS to the corresponding Host when a Visitor Checks In
	    // SMS cannot be sent to phone numbers other than a few white-listed contacts (in the trial version of the NEXMO API)
	    // My white-listed contacts are 919870843501, 919670785220, 918057471264
      // SMS can sent to any number after a premium verison of the API is purchased
      const nexmo = new Nexmo({
        apiKey: '081a8c0c', // My API key (different for every user)
        apiSecret: 'Lxz3xWJmRDpp4SvC' // My API key (different for every user
      });
      const from = 919670785220 // One of the White-listed numbers mentioned above (Sender phone)
      const to = 918057471264 // One of the White-listed numbers mentioned above (Receiver phone)
      const text = `${messageHost}\n\n\n\n\n Name - ${name}\n Email - ${email}\n Phone - ${phone}\n Check In Time - ${checkIn}\n` // Body of the SMS being sent
  
      nexmo.message.sendSms(from, to, text, (err, responseData) => {
        if (err) {
          console.log(err);
        } else {
          if(responseData.messages[0]['status'] === "0") {
            console.log("Message sent successfully!");
          } else {
            console.log(`Message failed with error: ${responseData.messages[0]['error-text']}`);
          }
        }
      });
    }
  });
});

// NEW - Show form to create new Visitor
app.get("/visitors/new", isLoggedIn, function(req, res) {
  res.render("new");
});

// REMOVE - Visitor checks out and is removed from list of visitors in the '/visitors' page. He/She is still present in the DB 
app.post("/visitors/:id", isLoggedIn, hostDetails, function(req, res){
  Visitor.findByIdAndRemove(req.params.id, function(err, foundVisitor){
    if(err){
      console.log(err);
    } else {
    // Send mail to Visitor when Checking Out
      const mailOptions = {
        from: process.env.EMAIL, // Sender Email
        to: foundVisitor.email, // Receiver Email
        subject: 'Checked Out Successfully', // Subject Line
        text: `${messageVisitor}\n\n\n\n\n Name - ${foundVisitor.name}\n Email - ${foundVisitor.email}\n Phone - ${foundVisitor.phone}\n Check In Time - ${foundVisitor.checkIn}\n Check Out Time - ${indiaTime.toLocaleString()}\n Host Name - ${req.user.username}\n Address Visited - ${foundVisitor.address}\n` // plain text body
      };
      console.log(mailOptions)
      console.log(transporter)
      transporter.sendMail(mailOptions, function (err, info) {
        if(err) {
          console.log("Error Occurred")
          console.log(err)
        } else {
          console.log("Email sent successfully!")
          console.log(info);
        }
      });
      res. redirect("/visitors");
    }
  });
});

// SHOW - Display the Checkout Message
app.get("/visitors/:id", function(req, res) {
  Visitor.findById(req.params.id, function(err, foundVisitor) {
    if(err) {
      console.log(err);
    } else {
      res.render("checkout", {visitor: foundVisitor});
    }
  });
});



// ======================
// AUTHENTICATION ROUTES
// ======================

// Show register form
app.get("/register", function(req, res){
  res.render("register");
});

// Handle SignUp Logic
app.post("/register", function(req, res){
  var newUser = new User({username: req.body.username, email: req.body.email, phone: req.body.phone});
  User.register(newUser, req.body.password, function(err, user){
    if(err) {
      console.log(err);
      return res.render("register");
    }
    passport.authenticate("local")(req, res, function(){
      res.redirect("/visitors");
    });
  });
});

// Show Login Form
app.get("/login", function(req, res){
  res.render("landing");
});

// Handle Login Logic
app.post("/login", passport.authenticate("local",
  {
    successRedirect: "/visitors",
    failureRedirect: "/login"
  }), function(req, res){
});

// Logout Route
app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});



// =============
// MIDDLEWARES
// =============

// To keep the host details which can be used for sending Email and SMS
function hostDetails(req, res, next) {
  if(req.user) {
    req.username = req.user.username;
    req.email = req.user.email;
    req.address = req.user.address;
  }
  next();
}

// To check whether host is logged in or not
function isLoggedIn(req, res, next){
  if(req.isAuthenticated()){
    return next();
  }
  res.redirect("/login");
}



// Running Server

app.listen(port, hostname, () => {
  console.log(`Server running at http://127.0.0.1:3000/`);
})