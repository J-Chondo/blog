

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const pg = require("pg");
const bcrypt = require("bcrypt");
const _ = require("lodash")
const flash = require("express-flash");
const env = require("dotenv"); 


const homeStartingContent = "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing.";
const aboutContent = "Hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Dictumst vestibulum rhoncus est pellentesque elit ullamcorper. Non diam phasellus vestibulum lorem sed. Platea dictumst quisque sagittis purus sit. Egestas sed sed risus pretium quam vulputate dignissim suspendisse. Mauris in aliquam sem fringilla. Semper risus in hendrerit gravida rutrum quisque non tellus orci. Amet massa vitae tortor condimentum lacinia quis vel eros. Enim ut tellus elementum sagittis vitae. Mauris ultrices eros in cursus turpis massa tincidunt dui.";
const contactContent = "Scelerisque eleifend donec pretium vulputate sapien. Rhoncus urna neque viverra justo nec ultrices. Arcu dui vivamus arcu felis bibendum. Consectetur adipiscing elit duis tristique. Risus viverra adipiscing at in tellus integer feugiat. Sapien nec sagittis aliquam malesuada bibendum arcu vitae. Consequat interdum varius sit amet mattis. Iaculis nunc sed augue lacus. Interdum posuere lorem ipsum dolor sit amet consectetur adipiscing elit. Pulvinar elementum integer enim neque. Ultrices gravida dictum fusce ut placerat orci nulla. Mauris in aliquam sem fringilla ut morbi tincidunt. Tortor posuere ac ut consequat semper viverra nam libero.";


  

const app = express();
const port = process.ENV || 5000;
const saltRounds = 10;
env.config();

// Set up session and passport
app.use(session({
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: false
}));

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));



app.use(passport.initialize());
app.use(passport.session());
app.use(flash());


const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();


let posts = [
  {
   id: 1, 
   date: "20/20/2020", 
   title: "WHY MUSCULINITY IS IMPORTANT" , 
   content: "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing", 
   author: "Joel chondo" }
  
];
  
//  home route

app.get("/",async (req, res) =>{
  try {
    const result = await db.query("SELECT * FROM posts ORDER BY date DESC");
    posts = result.rows;
   
    res.render("home", {
      StartingContent: homeStartingContent,
      posts: posts
    });
  } catch (err) {
    console.log(err)
  }
    
});

//  about route

app.get("/about", (req, res) =>{
  res.render("about", {
    aboutMeContent: aboutContent});
});

//  contact route

app.get("/contact", (req, res) =>{
  res.render("contact", {
    contactMeContent: contactContent});
});

//  register route

app.get("/register", (req, res) => {
  res.render("register", { message: req.flash("error") });
});

//  log in route

app.get("/login", (req, res) =>{
  res.render("login", { message: req.flash("error") });
});

// compose route which require authentication

app.get("/compose",  ensureAuthenticated, (req, res) =>{
   res.render("compose")

});



// post route for adding my posts to "/" and persesting in my database

app.post("/compose", async (req, res) => {
  const post = {
    title: req.body.postTitle,
    content: req.body.postBody,
    date: req.body.postDate,
    author: req.body.postAuthor,
  };

  try {
    const result = await db.query(
      "INSERT INTO posts(title, content, date, author) VALUES($1, $2, $3, $4) RETURNING *",
      [post.title, post.content, post.date, post.author]
    );

    const newPost = result.rows[0];
    posts.push(newPost);

    res.redirect("/");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error inserting post into the database");
  }
});



// registering post route which add my credetial to database

const MAX_USERS = 2; // Set the maximum number of users allowed

app.post("/register", async (req, res) => {
  try {
    // Check if the maximum number of users is reached
    const userCountResult = await db.query("SELECT COUNT(*) FROM user_registrations");
    const userCount = parseInt(userCountResult.rows[0].count, 10);

    if (userCount >= MAX_USERS) {
      req.flash("error", "Maximum number of users reached");
      return res.redirect("/login");
    }

    const { email, password } = req.body;

    // Check if the user already exists
    const userExists = await db.query("SELECT * FROM user_registrations WHERE email = $1", [email]);

    if (userExists.rows.length > 0) {
      req.flash("error", "User with this email already exists. Try logging in.");
      return res.redirect("/login");
    }

    // Hash the password using bcrypt
    bcrypt.hash(password, saltRounds, async (err, hash) => {
      if (err) {
        console.log("Error hashing password:", err);
        return res.status(500).send("Error hashing password");
      }

      try {
        // If the user doesn't exist, insert them into the database
        await db.query("INSERT INTO user_registrations(email, password) VALUES($1, $2)", [email, hash]);

        // Log the user in after successful registration
        req.flash("success", "Registration successful");
        return res.redirect("/login");
      } catch (error) {
        console.log(error);
        res.status(500).send("Error registering user");
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error checking user existence");
  }
});



// Use the local strategy for username/password authentication

passport.use(new LocalStrategy(
  async (email, password, done) => {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = result.rows[0];

      if (!user) {                                     
        return done(null, false, { message: "Incorrect email." });
      }

      // Use bcrypt.compare to compare the provided password with the hashed password
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return done(null, false, { message: "Incorrect password." });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// post login route which direct me to compose route one authentication is passed

app.post("/login", passport.authenticate("local", {
  successRedirect: "/compose",
  failureRedirect: "/login",
  failureFlash: true
}));

// params route which help me to view post in there url

app.get("/posts/:postName", (req, res) =>{
  const requestedTitle = _.lowerCase(req.params.postName);

  posts.forEach((post) =>{
    const storedTitle = _.lowerCase(post.title)

    if (storedTitle === requestedTitle) {
      res.render("post", {
        title: post.title,
        content: post.content,
        date: post.date,
        author:post.author,
      });
    } 
  });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/login");
  }
}






// serialization and deserialization logic
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    const user = result.rows[0];

    if (!user) {
      return done(new Error('User not found in the database'), null);
    }

    done(null, user);
  } catch (err) {
    done(err, null);
  }
});









app.listen(port, () => {
  console.log("Server started on port 5000");
});
