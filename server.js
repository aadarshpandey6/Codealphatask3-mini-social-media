const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./social.db");

// --------------------
// Database setup
// --------------------

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      PRIMARY KEY(user_id, post_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(post_id) REFERENCES posts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS followers (
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      PRIMARY KEY(follower_id, following_id),
      FOREIGN KEY(follower_id) REFERENCES users(id),
      FOREIGN KEY(following_id) REFERENCES users(id)
    )
  `);

  // Demo users
  db.run(
    `INSERT OR IGNORE INTO users (id, username, bio)
     VALUES (1, 'alice', 'Hello! I love coding.')`
  );

  db.run(
    `INSERT OR IGNORE INTO users (id, username, bio)
     VALUES (2, 'bob', 'Web developer 🚀')`
  );

  db.run(
    `INSERT OR IGNORE INTO users (id, username, bio)
     VALUES (3, 'charlie', 'Photography & travel 📷')`
  );
});

// --------------------
// USERS
// --------------------

// Get all users
app.get("/api/users", (req, res) => {
  db.all(
    `SELECT id, username, bio, avatar FROM users ORDER BY username`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json(rows);
    }
  );
});

// Get user profile
app.get("/api/users/:id", (req, res) => {
  const userId = req.params.id;

  db.get(
    `
    SELECT
      u.id,
      u.username,
      u.bio,
      u.avatar,
      (SELECT COUNT(*) FROM followers WHERE following_id = u.id) AS followers,
      (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) AS following
    FROM users u
    WHERE u.id = ?
    `,
    [userId],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    }
  );
});

// Create user
app.post("/api/users", (req, res) => {
  const { username, bio = "" } = req.body;

  if (!username || !username.trim()) {
    return res.status(400).json({
      error: "Username is required"
    });
  }

  db.run(
    `INSERT INTO users (username, bio) VALUES (?, ?)`,
    [username.trim(), bio],
    function (err) {
      if (err) {
        return res.status(400).json({
          error: "Username already exists"
        });
      }

      res.status(201).json({
        id: this.lastID,
        username,
        bio
      });
    }
  );
});

// --------------------
// POSTS
// --------------------

// Get posts
app.get("/api/posts", (req, res) => {
  const currentUserId = Number(req.query.user_id) || 1;

  db.all(
    `
    SELECT
      p.id,
      p.content,
      p.created_at,
      u.id AS user_id,
      u.username,
      u.avatar,

      (SELECT COUNT(*)
       FROM likes
       WHERE likes.post_id = p.id) AS likes,

      EXISTS(
        SELECT 1
        FROM likes
        WHERE likes.post_id = p.id
        AND likes.user_id = ?
      ) AS liked

    FROM posts p

    JOIN users u
      ON p.user_id = u.id

    ORDER BY p.created_at DESC
    `,
    [currentUserId],
    (err, posts) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json(posts);
    }
  );
});

// Create post
app.post("/api/posts", (req, res) => {
  const { user_id, content } = req.body;

  if (!user_id || !content || !content.trim()) {
    return res.status(400).json({
      error: "User and content are required"
    });
  }

  db.run(
    `
    INSERT INTO posts (user_id, content)
    VALUES (?, ?)
    `,
    [user_id, content.trim()],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.status(201).json({
        id: this.lastID,
        message: "Post created successfully"
      });
    }
  );
});

// Delete post
app.delete("/api/posts/:id", (req, res) => {
  const postId = req.params.id;

  db.serialize(() => {
    db.run(`DELETE FROM comments WHERE post_id = ?`, [postId]);
    db.run(`DELETE FROM likes WHERE post_id = ?`, [postId]);

    db.run(
      `DELETE FROM posts WHERE id = ?`,
      [postId],
      function (err) {
        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          message: "Post deleted"
        });
      }
    );
  });
});

// --------------------
// COMMENTS
// --------------------

// Get comments
app.get("/api/posts/:id/comments", (req, res) => {
  db.all(
    `
    SELECT
      c.id,
      c.content,
      c.created_at,
      u.id AS user_id,
      u.username
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
    `,
    [req.params.id],
    (err, comments) => {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.json(comments);
    }
  );
});

// Add comment
app.post("/api/posts/:id/comments", (req, res) => {
  const { user_id, content } = req.body;
  const postId = req.params.id;

  if (!user_id || !content || !content.trim()) {
    return res.status(400).json({
      error: "Comment cannot be empty"
    });
  }

  db.run(
    `
    INSERT INTO comments (post_id, user_id, content)
    VALUES (?, ?, ?)
    `,
    [postId, user_id, content.trim()],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.status(201).json({
        id: this.lastID,
        message: "Comment added"
      });
    }
  );
});

// --------------------
// LIKES
// --------------------

app.post("/api/posts/:id/like", (req, res) => {
  const postId = req.params.id;
  const { user_id } = req.body;

  db.get(
    `
    SELECT *
    FROM likes
    WHERE user_id = ?
    AND post_id = ?
    `,
    [user_id, postId],
    (err, like) => {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      if (like) {
        // Unlike
        db.run(
          `
          DELETE FROM likes
          WHERE user_id = ?
          AND post_id = ?
          `,
          [user_id, postId],
          err => {
            if (err) {
              return res.status(500).json({
                error: err.message
              });
            }

            res.json({
              liked: false
            });
          }
        );
      } else {
        // Like
        db.run(
          `
          INSERT INTO likes (user_id, post_id)
          VALUES (?, ?)
          `,
          [user_id, postId],
          err => {
            if (err) {
              return res.status(500).json({
                error: err.message
              });
            }

            res.json({
              liked: true
            });
          }
        );
      }
    }
  );
});

// --------------------
// FOLLOW SYSTEM
// --------------------

app.post("/api/users/:id/follow", (req, res) => {
  const followingId = req.params.id;
  const { follower_id } = req.body;

  if (Number(follower_id) === Number(followingId)) {
    return res.status(400).json({
      error: "You cannot follow yourself"
    });
  }

  db.get(
    `
    SELECT *
    FROM followers
    WHERE follower_id = ?
    AND following_id = ?
    `,
    [follower_id, followingId],
    (err, row) => {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      if (row) {
        // Unfollow
        db.run(
          `
          DELETE FROM followers
          WHERE follower_id = ?
          AND following_id = ?
          `,
          [follower_id, followingId],
          err => {
            if (err) {
              return res.status(500).json({
                error: err.message
              });
            }

            res.json({
              following: false
            });
          }
        );
      } else {
        // Follow
        db.run(
          `
          INSERT INTO followers (follower_id, following_id)
          VALUES (?, ?)
          `,
          [follower_id, followingId],
          err => {
            if (err) {
              return res.status(500).json({
                error: err.message
              });
            }

            res.json({
              following: true
            });
          }
        );
      }
    }
  );
});

// --------------------
// START SERVER
// --------------------


app.listen(PORT, () => {
  console.log(`Social media app running at http://localhost:${PORT}`);
});
