document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const roleSelect = document.getElementById("role");
  const roleHelp = document.getElementById("role-help");
  const organizerActions = document.getElementById("organizer-actions");
  const roleStorageKey = "mergington-current-role";
  const validRoles = new Set([
    "organizer",
    "approval_committee",
    "admin",
  ]);

  function getCurrentRole() {
    const storedRole = localStorage.getItem(roleStorageKey);

    if (validRoles.has(storedRole)) {
      return storedRole;
    }

    return "organizer";
  }

  function updateRoleUi(role) {
    const normalizedRole = validRoles.has(role) ? role : "organizer";

    roleSelect.value = normalizedRole;
    localStorage.setItem(roleStorageKey, normalizedRole);

    const roleDescriptions = {
      organizer:
        "Organizers can sign up and unregister students from activities.",
      approval_committee:
        "Approval committee members can add review notes to activities.",
      admin: "Admins can update activity capacity.",
    };

    roleHelp.textContent = roleDescriptions[normalizedRole];
    organizerActions.classList.toggle("hidden", normalizedRole !== "organizer");
  }

  function apiFetch(url, options = {}) {
    const headers = {
      "X-User-Role": getCurrentRole(),
      ...(options.headers || {}),
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }

  function showMessage(text, className) {
    messageDiv.textContent = text;
    messageDiv.className = className;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function renderReviews(reviews) {
    if (!reviews || reviews.length === 0) {
      return `<p><em>No reviews yet</em></p>`;
    }

    return `<div class="reviews-section">
      <h5>Reviews</h5>
      <ul class="reviews-list">
        ${reviews
          .map(
            (review) => `<li>${review.role}: ${review.comment}</li>`
          )
          .join("")}
      </ul>
    </div>`;
  }

  function handleReview(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const comment = prompt("Enter a review note for this activity:", "Looks good");

    if (comment === null) {
      return;
    }

    apiFetch(
      `/activities/${encodeURIComponent(
        activity
      )}/review?comment=${encodeURIComponent(comment)}`,
      {
        method: "POST",
      }
    )
      .then((response) => response.json().then((result) => ({ response, result })))
      .then(({ response, result }) => {
        if (response.ok) {
          showMessage(result.message, "success");
          fetchActivities();
        } else {
          showMessage(result.detail || "An error occurred", "error");
        }
      })
      .catch((error) => {
        showMessage("Failed to save review. Please try again.", "error");
        console.error("Error saving review:", error);
      });
  }

  function handleCapacityUpdate(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const capacityInput = prompt(
      "Enter the new maximum participant count:",
      "20"
    );

    if (capacityInput === null) {
      return;
    }

    const newCapacity = Number.parseInt(capacityInput, 10);

    if (Number.isNaN(newCapacity) || newCapacity < 1) {
      showMessage("Please enter a valid capacity greater than zero.", "error");
      return;
    }

    apiFetch(
      `/activities/${encodeURIComponent(
        activity
      )}/capacity?max_participants=${encodeURIComponent(newCapacity)}`,
      {
        method: "POST",
      }
    )
      .then((response) => response.json().then((result) => ({ response, result })))
      .then(({ response, result }) => {
        if (response.ok) {
          showMessage(result.message, "success");
          fetchActivities();
        } else {
          showMessage(result.detail || "An error occurred", "error");
        }
      })
      .catch((error) => {
        showMessage("Failed to update capacity. Please try again.", "error");
        console.error("Error updating capacity:", error);
      });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await apiFetch("/activities");
      const activities = await response.json();
      const currentRole = getCurrentRole();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${currentRole === "organizer" ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""}</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        const roleActionsHTML =
          currentRole === "approval_committee"
            ? `<button class="review-btn" data-activity="${name}">Add review note</button>`
            : currentRole === "admin"
              ? `<button class="capacity-btn" data-activity="${name}">Update capacity</button>`
              : "";

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${roleActionsHTML ? `<div class="activity-actions">${roleActionsHTML}</div>` : ""}
          <div class="participants-container">
            ${participantsHTML}
          </div>
          ${renderReviews(details.reviews)}
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });

      document.querySelectorAll(".review-btn").forEach((button) => {
        button.addEventListener("click", handleReview);
      });

      document.querySelectorAll(".capacity-btn").forEach((button) => {
        button.addEventListener("click", handleCapacityUpdate);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  roleSelect.addEventListener("change", (event) => {
    updateRoleUi(event.target.value);
    fetchActivities();
  });

  // Initialize app
  updateRoleUi(getCurrentRole());
  fetchActivities();
});
