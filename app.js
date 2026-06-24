const API_URL = "https://de3iqs0cmf.execute-api.us-east-1.amazonaws.com";
const COGNITO_REGION = "us-east-1";
const COGNITO_USER_POOL_ID = "us-east-1_XMZ0V6UPr";
const COGNITO_CLIENT_ID = "572er9r6s71bgr07bj118c2tn1";

const poolData = {
  UserPoolId: COGNITO_USER_POOL_ID,
  ClientId: COGNITO_CLIENT_ID,
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

let idToken = localStorage.getItem("idToken") || "";
let currentUserRole = localStorage.getItem("currentUserRole") || "Guest";
let allItems = [];
let currentView = "all";

function getCurrentUserId() {
  if (!idToken) return "";
  const claims = parseJwt(idToken);
  return claims.sub || "";
}

function getEl(id) {
  return document.getElementById(id);
}

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Invalid token:", error);
    return {};
  }
}

function isLoggedIn() {
  return !!idToken;
}

function isAdminUser() {
  return currentUserRole === "Admin";
}

function getAuthHeaders(json = false) {
  const headers = {
    Authorization: `Bearer ${idToken}`,
  };

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function updateAuthStatus() {
  const authStatus = getEl("authStatus");
  const roleStatus = getEl("roleStatus");

  if (authStatus) {
    authStatus.innerText = idToken ? "Logged in" : "Not logged in";
  }

  if (roleStatus) {
    roleStatus.innerText = `Role: ${currentUserRole}`;
  }
  updateRoleBasedUI();
}

function showAuthTab(tabName) {
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const tab = getEl(`${tabName}Tab`);
  if (tab) tab.classList.add("active");

  const buttons = document.querySelectorAll(".tab-btn");
  const index = tabName === "login" ? 0 : tabName === "register" ? 1 : 2;
  if (buttons[index]) buttons[index].classList.add("active");
}

function registerUser() {
  const email = getEl("registerEmail").value.trim().toLowerCase();
  const password = getEl("registerPassword").value.trim();

  if (!email || !password) {
    alert("Please enter email and password");
    return;
  }

  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: "email",
      Value: email,
    }),
  ];

  userPool.signUp(email, password, attributeList, null, function (err, result) {
    if (err) {
      console.error(err);
      showToast(
        "Registration failed",
        err.message || JSON.stringify(err),
        "error",
      );
      return;
    }

    showToast(
      "Registration successful",
      "Check your email for the confirmation code.",
      "success",
    );

    const confirmEmail = getEl("confirmEmail");
    if (confirmEmail) confirmEmail.value = email;
    showAuthTab("confirm");
    console.log(result);
  });
}

function confirmUser() {
  const email = getEl("confirmEmail").value.trim().toLowerCase();
  const code = getEl("confirmCode").value.trim();

  if (!email || !code) {
    alert("Please enter email and confirmation code");
    return;
  }

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: email,
    Pool: userPool,
  });

  cognitoUser.confirmRegistration(code, true, function (err, result) {
    if (err) {
      console.error(err);
      showToast(
        "Confirmation failed",
        err.message || JSON.stringify(err),
        "error",
      );
      return;
    }

    showToast("Account confirmed", "You can login now.", "success");
    const loginEmail = getEl("loginEmail");
    if (loginEmail) loginEmail.value = email;
    showAuthTab("login");
    console.log(result);
  });
}

function loginUser() {
  const email = getEl("loginEmail").value.trim().toLowerCase();
  const password = getEl("loginPassword").value.trim();

  if (!email || !password) {
    alert("Please enter email and password");
    return;
  }

  const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(
    {
      Username: email,
      Password: password,
    },
  );

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: email,
    Pool: userPool,
  });

  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: function (result) {
      idToken = result.getIdToken().getJwtToken();
      localStorage.setItem("idToken", idToken);

      const claims = parseJwt(idToken);
      const groups = claims["cognito:groups"] || [];

      currentUserRole = groups.includes("Admin") ? "Admin" : "User";
      localStorage.setItem("currentUserRole", currentUserRole);

      updateAuthStatus();
      showToast("Login successful", "Redirecting to dashboard...", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 700);
    },

    onFailure: function (err) {
      console.error(err);
      showToast("Login failed", err.message || JSON.stringify(err), "error");
    },
  });
}

function logoutUser() {
  const currentUser = userPool.getCurrentUser();

  if (currentUser) {
    currentUser.signOut();
  }

  idToken = "";
  currentUserRole = "Guest";

  localStorage.removeItem("idToken");
  localStorage.removeItem("currentUserRole");

  updateAuthStatus();
  window.location.href = "auth.html";
}

function requireAuthOnDashboard() {
  const isDashboard = document.body.classList.contains("dashboard-page");

  if (isDashboard && !idToken) {
    window.location.href = "auth.html";
  }
}

function previewSelectedImage(event) {
  const file = event.target.files[0];
  const previewBox = getEl("imagePreviewBox");
  const previewImage = getEl("imagePreview");

  if (!file || !previewBox || !previewImage) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    showToast("Invalid file", "Please upload an image file only.", "warning");
    event.target.value = "";
    return;
  }

  const imageUrl = URL.createObjectURL(file);

  previewImage.src = imageUrl;
  previewBox.classList.add("show");
}

function removeSelectedImage() {
  const imageInput = getEl("image");
  const previewBox = getEl("imagePreviewBox");
  const previewImage = getEl("imagePreview");

  if (imageInput) {
    imageInput.value = "";
  }

  if (previewImage) {
    previewImage.src = "";
  }

  if (previewBox) {
    previewBox.classList.remove("show");
  }
}

async function addItem(button) {
  if (!isLoggedIn()) {
    showToast("Login required", "Please login first.", "warning");
    window.location.href = "auth.html";
    return;
  }

  const title = getEl("title").value.trim();
  const description = getEl("description").value.trim();
  const status = getEl("status").value;
  const category = getEl("category").value;
  const location = getEl("location").value.trim();
  const contactInfo = getEl("contactInfo").value.trim();
  const imageFile = getEl("image").files[0];
  const priority = getEl("priority").value;

  if (!title || !description) {
    showToast(
      "Missing details",
      "Please enter title and description.",
      "warning",
    );
    return;
  }

  let imageBase64 = "";

  if (imageFile) {
    imageBase64 = await toBase64(imageFile);
    imageBase64 = imageBase64.split(",")[1];
  }

  setButtonLoading(button, true, "Submitting...");

  try {
    const response = await fetch(`${API_URL}/items`, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        title,
        description,
        status,
        category,
        location,
        contactInfo,
        priority,
        imageBase64,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API Error:", data);
      showToast("Error adding item", JSON.stringify(data), "error");
      return;
    }

    showToast("Item added", "The item was submitted successfully.", "success");

    ["title", "description", "location", "contactInfo", "image"].forEach(
      (id) => {
        const element = getEl(id);
        if (element) element.value = "";
      },
    );
    removeSelectedImage();

    loadItems();
  } catch (error) {
    console.error("Fetch Error:", error);
    showToast("Connection failed", "Failed to connect to API.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function loadItems(button) {
  if (!isLoggedIn()) {
    showToast("Login required", "Please login first.", "warning");
    window.location.href = "auth.html";
    return;
  }

  setButtonLoading(button, true, "Loading...");

  try {
    const response = await fetch(`${API_URL}/items`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API Error:", data);
      showToast("Error loading items", JSON.stringify(data), "error");
      return;
    }

    if (!Array.isArray(data)) {
      console.error("Invalid response:", data);
      showToast(
        "Invalid response",
        "The API returned unexpected data.",
        "error",
      );
      return;
    }

    allItems = data;
    updateDashboardStats(allItems);
    updateViewCounts(allItems);
    renderItems();
  } catch (error) {
    console.error("Fetch Error:", error);
    showToast("Connection failed", "Failed to load items.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}
function getStatusTimeline(item) {
  const status = item.status || "Lost";

  const isClaimed = status === "Claimed" || status === "Returned";
  const isReturned = status === "Returned";

  return `
    <div class="status-timeline">
      <div class="timeline-step active">
        <span class="timeline-dot"></span>
        <div>
          <strong>Reported</strong>
          <small>${item.createdAt ? formatDate(item.createdAt) : "Submitted"}</small>
        </div>
      </div>

      <div class="timeline-line ${isClaimed ? "active" : ""}"></div>

      <div class="timeline-step ${isClaimed ? "active" : ""}">
        <span class="timeline-dot"></span>
        <div>
          <strong>Claimed</strong>
          <small>${item.claimedAt ? formatDate(item.claimedAt) : "Pending claim"}</small>
        </div>
      </div>

      <div class="timeline-line ${isReturned ? "active" : ""}"></div>

      <div class="timeline-step ${isReturned ? "active" : ""}">
        <span class="timeline-dot"></span>
        <div>
          <strong>Returned</strong>
          <small>${item.returnedAt ? formatDate(item.returnedAt) : "Pending return"}</small>
        </div>
      </div>
    </div>
  `;
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (error) {
    return "Unknown date";
  }
}

function updateViewCounts(items) {
  const currentUserId = getCurrentUserId();

  const counts = {
    allItemsViewCount: items.length,

    myReportsViewCount: items.filter(
      (item) => item.createdByUserId === currentUserId,
    ).length,

    myClaimsViewCount: items.filter(
      (item) => item.claimedByUserId === currentUserId,
    ).length,

    adminQueueViewCount: items.filter((item) => item.status === "Claimed")
      .length,
  };

  Object.entries(counts).forEach(([id, value]) => {
    const element = getEl(id);

    if (element) {
      element.innerText = value;
    }
  });
}

function renderItems() {
  const container = getEl("items");
  if (!container) return;

  const searchValue = getEl("searchInput")
    ? getEl("searchInput").value.toLowerCase()
    : "";

  const statusFilter = getEl("statusFilter")
    ? getEl("statusFilter").value
    : "All";

  const currentUserId = getCurrentUserId();

  const filteredItems = allItems.filter((item) => {
    const labelsText = item.labels ? item.labels.join(" ").toLowerCase() : "";

    const combinedText = `
    ${item.title || ""}
    ${item.description || ""}
    ${item.location || ""}
    ${item.category || ""}
    ${labelsText}
  `.toLowerCase();

    const matchesSearch = combinedText.includes(searchValue);
    const matchesStatus =
      statusFilter === "All" || item.status === statusFilter;

    const matchesView =
      currentView === "all" ||
      (currentView === "myReports" && item.createdByUserId === currentUserId) ||
      (currentView === "myClaims" && item.claimedByUserId === currentUserId) ||
      (currentView === "adminQueue" &&
        isAdminUser() &&
        item.status === "Claimed");

    return matchesSearch && matchesStatus && matchesView;
  });

  container.innerHTML = "";

  if (filteredItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No items found</h3>
        <p>Try changing the search text or status filter.</p>
      </div>
    `;
    return;
  }

  filteredItems.forEach((item) => {
    const statusClass = (item.status || "Lost").toLowerCase();

    container.innerHTML += `
      <div class="card">
        ${item.displayImageUrl ? `<img src="${item.displayImageUrl}" alt="Item Image">` : ""}

        <h3>${item.title || "No title"}</h3>

        <div class="badges">
          <span class="badge ${statusClass}">${item.status || "Lost"}</span>
          <span class="badge">${item.category || "Other"}</span>
        </div>

        <p>${item.description || "No description"}</p>
        <p><strong>Location:</strong> ${item.location || "Not specified"}</p>
        <p><strong>Contact:</strong> ${item.contactInfo || "Not provided"}</p>

        <p>
          <strong>AI Labels:</strong>
          ${item.labels && item.labels.length > 0 ? item.labels.join(", ") : "No labels"}
        </p>
        ${getStatusTimeline(item)}

${
  item.claimantName
    ? `
      <div class="claim-box">
        <p><strong>Claimed by:</strong> ${item.claimantName}</p>
        <p><strong>Claim Contact:</strong> ${item.claimantContact || "Not provided"}</p>
        ${
          item.claimedByEmail
            ? `<p><strong>Claim Email:</strong> ${item.claimedByEmail}</p>`
            : ""
        }
        ${
          item.claimReason
            ? `<p><strong>Claim Reason:</strong> ${item.claimReason}</p>`
            : ""
        }
      </div>
    `
    : ""
}

        <small>${item.itemId}</small>

        ${
          item.status !== "Returned"
            ? `
              <div class="card-actions">
                ${
                  isLoggedIn() &&
                  item.status !== "Claimed" &&
                  item.status !== "Returned"
                    ? `<button class="claim-btn" onclick="openClaimModal('${item.itemId}')">
  Claim This Item
</button>`
                    : ""
                }

                ${
                  isAdminUser() && item.status !== "Returned"
                    ? `<button class="returned-btn" onclick="openReturnConfirmModal('${item.itemId}')">
  Mark as Returned
</button>`
                    : ""
                }
                    
                ${
                  isAdminUser()
                    ? `<button class="delete-btn" onclick="openDeleteConfirmModal('${item.itemId}', '${item.title || "this item"}')">
        Delete Item
      </button>`
                    : ""
                }
              </div>
            `
            : ""
        }
      </div>
    `;
  });
}

function updateDashboardStats(items) {
  const counters = {
    totalCount: items.length,
    lostCount: items.filter((item) => item.status === "Lost").length,
    foundCount: items.filter((item) => item.status === "Found").length,
    claimedCount: items.filter((item) => item.status === "Claimed").length,
    returnedCount: items.filter((item) => item.status === "Returned").length,
  };

  Object.entries(counters).forEach(([id, value]) => {
    const element = getEl(id);
    if (element) element.innerText = value;
  });
}

function openReturnConfirmModal(itemId) {
  if (!isAdminUser()) {
    showToast(
      "Access denied",
      "Only admins can mark items as returned.",
      "error",
    );
    return;
  }

  const modal = getEl("returnConfirmModal");
  const returnItemId = getEl("returnItemId");

  if (!modal || !returnItemId) {
    showToast("System error", "Return confirmation modal not found.", "error");
    return;
  }

  returnItemId.value = itemId;
  modal.classList.add("show");
}

function closeReturnConfirmModal() {
  const modal = getEl("returnConfirmModal");

  if (modal) {
    modal.classList.remove("show");
  }
}

async function submitReturnConfirmation(button) {
  const itemId = getEl("returnItemId").value;

  if (!itemId) {
    showToast("Missing item", "Missing item ID.", "error");
    return;
  }

  setButtonLoading(button, true, "Updating...");

  try {
    const response = await fetch(`${API_URL}/items/status`, {
      method: "PUT",
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        itemId,
        status: "Returned",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API Error:", data);
      showToast("Update failed", JSON.stringify(data), "error");
      return;
    }

    closeReturnConfirmModal();

    showToast(
      "Item returned",
      "The item status was updated successfully.",
      "success",
    );

    loadItems();
  } catch (error) {
    console.error("Fetch Error:", error);
    showToast("Connection failed", "Failed to update item.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}
function openClaimModal(itemId) {
  if (!isLoggedIn()) {
    showToast("Login required", "Please login first.", "warning");
    window.location.href = "auth.html";
    return;
  }

  const modal = getEl("claimModal");
  const claimItemId = getEl("claimItemId");

  if (!modal || !claimItemId) {
    showToast("System error", "Claim modal not found.", "error");
    return;
  }

  claimItemId.value = itemId;

  const claimantName = getEl("claimantName");
  const claimantContact = getEl("claimantContact");
  const claimReason = getEl("claimReason");

  if (claimantName) claimantName.value = "";
  if (claimantContact) claimantContact.value = "";
  if (claimReason) claimReason.value = "";

  modal.classList.add("show");
}

function closeClaimModal() {
  const modal = getEl("claimModal");

  if (modal) {
    modal.classList.remove("show");
  }
}

async function submitClaimFromModal(button) {
  const itemId = getEl("claimItemId").value;
  const claimantName = getEl("claimantName").value.trim();
  const claimantContact = getEl("claimantContact").value.trim();
  const claimReason = getEl("claimReason").value.trim();

  if (!itemId) {
    showToast("Missing item", "Missing item ID.", "error");
    return;
  }

  if (!claimantName || !claimantContact) {
    showToast(
      "Missing claim details",
      "Please enter your name and contact info.",
      "warning",
    );
    return;
  }

  setButtonLoading(button, true, "Submitting...");

  try {
    const response = await fetch(`${API_URL}/items/claim`, {
      method: "PUT",
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        itemId,
        claimantName,
        claimantContact,
        claimReason,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API Error:", data);
      showToast("Claim failed", JSON.stringify(data), "error");
      return;
    }

    showToast(
      "Claim submitted",
      "Your claim request was submitted successfully.",
      "success",
    );

    closeClaimModal();

    currentView = "myClaims";
    setItemsView("myClaims");

    loadItems();
  } catch (error) {
    console.error("Fetch Error:", error);
    showToast("Connection failed", "Failed to submit claim.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

function scrollToForm() {
  const reportForm = getEl("reportForm");
  if (reportForm) {
    reportForm.scrollIntoView({ behavior: "smooth" });
  } else {
    window.location.href = "dashboard.html#reportForm";
  }
}
function openDeleteConfirmModal(itemId, itemTitle = "this item") {
  if (!isAdminUser()) {
    showToast("Access denied", "Only admins can delete items.", "error");
    return;
  }

  const modal = getEl("deleteConfirmModal");
  const deleteItemId = getEl("deleteItemId");
  const deleteItemTitle = getEl("deleteItemTitle");

  if (!modal || !deleteItemId) {
    showToast("System error", "Delete confirmation modal not found.", "error");
    return;
  }

  deleteItemId.value = itemId;

  if (deleteItemTitle) {
    deleteItemTitle.innerText = itemTitle;
  }

  modal.classList.add("show");
}

function closeDeleteConfirmModal() {
  const modal = getEl("deleteConfirmModal");

  if (modal) {
    modal.classList.remove("show");
  }
}

async function submitDeleteConfirmation(button) {
  const itemId = getEl("deleteItemId").value;

  if (!itemId) {
    showToast("Missing item", "Missing item ID.", "error");
    return;
  }

  setButtonLoading(button, true, "Deleting...");

  try {
    const response = await fetch(`${API_URL}/items/${itemId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API Error:", data);
      showToast("Delete failed", JSON.stringify(data), "error");
      return;
    }

    closeDeleteConfirmModal();

    showToast("Item deleted", "The item was deleted successfully.", "success");

    loadItems();
  } catch (error) {
    console.error("Fetch Error:", error);
    showToast("Connection failed", "Failed to delete item.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  updateAuthStatus();
  requireAuthOnDashboard();

  const returnConfirmModal = getEl("returnConfirmModal");

  if (returnConfirmModal) {
    returnConfirmModal.addEventListener("click", function (event) {
      if (event.target === returnConfirmModal) {
        closeReturnConfirmModal();
      }
    });
  }

  const claimModal = getEl("claimModal");

  if (claimModal) {
    claimModal.addEventListener("click", function (event) {
      if (event.target === claimModal) {
        closeClaimModal();
      }
    });
  }

  const deleteConfirmModal = getEl("deleteConfirmModal");

  if (deleteConfirmModal) {
    deleteConfirmModal.addEventListener("click", function (event) {
      if (event.target === deleteConfirmModal) {
        closeDeleteConfirmModal();
      }
    });
  }

  if (document.body.classList.contains("dashboard-page") && idToken) {
    loadItems();
  }
});

function setItemsView(view) {
  currentView = view;

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(`[data-view="${view}"]`);

  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  renderItems();
}

function updateRoleBasedUI() {
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.style.display = isAdminUser() ? "inline-flex" : "none";
  });
}

function showToast(title, message = "", type = "success") {
  const container = getEl("toastContainer");

  if (!container) {
    console.log(`${title}: ${message}`);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    ${message ? `<div class="toast-message">${message}</div>` : ""}
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");

    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3200);
}

function setButtonLoading(button, isLoading, loadingText = "Loading...") {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.innerText;
    button.innerText = loadingText;
    button.disabled = true;
    button.classList.add("is-loading");
  } else {
    button.innerText = button.dataset.originalText || button.innerText;
    button.disabled = false;
    button.classList.remove("is-loading");
  }
}
