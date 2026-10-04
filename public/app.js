let currentUserId = 1;

async function loadUsers() {

    const response = await fetch("/api/users");
    const users = await response.json();

    const select = document.getElementById("currentUser");

    select.innerHTML = "";

    users.forEach(user => {

        const option = document.createElement("option");

        option.value = user.id;
        option.textContent = user.username;

        select.appendChild(option);
    });

    select.value = currentUserId;

    select.addEventListener("change", () => {

        currentUserId = Number(select.value);

        loadProfile();
        loadPosts();
        loadUsersList();

    });

    loadProfile();
    loadUsersList();
}

async function loadProfile() {

    const response =
        await fetch(`/api/users/${currentUserId}`);

    const user = await response.json();

    document.getElementById("profileName")
        .textContent = user.username;

    document.getElementById("profileBio")
        .textContent = user.bio || "No bio available";

    document.getElementById("followersCount")
        .textContent = user.followers;

    document.getElementById("followingCount")
        .textContent = user.following;
}

async function loadUsersList() {

    const response = await fetch("/api/users");
    const users = await response.json();

    const container =
        document.getElementById("usersList");

    container.innerHTML = "";

    users.forEach(user => {

        if (user.id === currentUserId) {
            return;
        }

        const div = document.createElement("div");

        div.className = "user-card";

        div.innerHTML = `
            <div>
                <strong>${escapeHTML(user.username)}</strong>
                <br>
                <small>${escapeHTML(user.bio)}</small>
            </div>

            <button onclick="toggleFollow(${user.id})">
                Follow / Unfollow
            </button>
        `;

        container.appendChild(div);
    });
}

async function toggleFollow(userId) {

    await fetch(`/api/users/${userId}/follow`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            follower_id: currentUserId
        })
    });

    loadProfile();
    loadUsersList();
}

async function createPost() {

    const textarea =
        document.getElementById("postContent");

    const content = textarea.value.trim();

    if (!content) {
        alert("Please write something first.");
        return;
    }

    await fetch("/api/posts", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            user_id: currentUserId,
            content: content
        })
    });

    textarea.value = "";

    loadPosts();
}

async function loadPosts() {

    const response =
        await fetch(`/api/posts?user_id=${currentUserId}`);

    const posts = await response.json();

    const feed =
        document.getElementById("feed");

    feed.innerHTML = "";

    posts.forEach(post => {

        const postElement =
            document.createElement("div");

        postElement.className = "post";

        postElement.innerHTML = `

            <div class="post-header">
                👤 ${escapeHTML(post.username)}
            </div>

            <div class="post-content">
                ${escapeHTML(post.content)}
            </div>

            <div class="post-actions">

                <button
                    class="like-btn"
                    onclick="likePost(${post.id})"
                >
                    ${post.liked ? "❤️" : "🤍"}
                    ${post.likes}
                </button>

            </div>

            <div class="comments">

                <strong>Comments</strong>

                <div id="comments-${post.id}">
                    Loading comments...
                </div>

                <div class="comment-form">

                    <input
                        id="comment-${post.id}"
                        placeholder="Write a comment..."
                    >

                    <button
                        onclick="addComment(${post.id})"
                    >
                        Comment
                    </button>

                </div>

            </div>
        `;

        feed.appendChild(postElement);

        loadComments(post.id);
    });
}

async function likePost(postId) {

    await fetch(`/api/posts/${postId}/like`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            user_id: currentUserId
        })
    });

    loadPosts();
}

async function loadComments(postId) {

    const response =
        await fetch(`/api/posts/${postId}/comments`);

    const comments = await response.json();

    const container =
        document.getElementById(`comments-${postId}`);

    if (!container) return;

    container.innerHTML = "";

    comments.forEach(comment => {

        const div =
            document.createElement("div");

        div.className = "comment";

        div.innerHTML = `
            <strong>${escapeHTML(comment.username)}</strong>
            <br>
            ${escapeHTML(comment.content)}
        `;

        container.appendChild(div);
    });
}

async function addComment(postId) {

    const input =
        document.getElementById(`comment-${postId}`);

    const content = input.value.trim();

    if (!content) return;

    await fetch(`/api/posts/${postId}/comments`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            user_id: currentUserId,
            content: content
        })
    });

    input.value = "";

    loadComments(postId);
}

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}

loadUsers();
loadPosts();
