document.addEventListener("DOMContentLoaded", () => {
  const yearElement = document.getElementById("year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  const caseList = document.getElementById("caseList");
  if (!caseList) return;

  // Extract authentication state from localStorage
  const token = localStorage.getItem('token');

  // Kick out unauthenticated traffic immediately
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  caseList.innerHTML = "<div class='col-12 text-center'><p class='text-muted'>Loading your personal case dashboard...</p></div>";

  // 🔐 SECURED: Swapped out absolute port mapping for a clean local relative request path
  fetch("/api/my-cases", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP tracking fault error: ${res.status}`);
      return res.json();
    })
    .then(data => {
      caseList.innerHTML = "";

      if (!data || !data.length) {
        caseList.innerHTML = "<div class='col-12 text-center'><p class='text-muted'>No cases matching your profile found.</p></div>";
        return;
      }

      data.forEach(c => {
        const card = document.createElement("div");
        card.className = "col-md-6 mb-4";

        // Map status tags into uniform color matrices across layout templates
        const statusColor = {
          open: "success",
          pending: "warning",
          closed: "secondary"
        }[c.status?.toLowerCase()] || "secondary";

        // Safely parse timestamps ensuring fallback presentation text is available
        const assignDateStr = c.assigned_date 
          ? new Date(c.assigned_date).toLocaleDateString() 
          : new Date(c.created_on).toLocaleDateString();

        card.innerHTML = `
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Case #${c.id}: ${c.title}</h5>
              <p class="card-text mb-1"><strong>Domain Area:</strong> ${c.area}</p>
              <p class="card-text mb-1">
                <strong>Status:</strong> 
                <span class="badge bg-${statusColor}">${c.status.toUpperCase()}</span>
              </p>
              <p class="card-text mb-3"><strong>Activity Tracking Date:</strong> ${assignDateStr}</p>
              <a href="case-details.html?id=${c.id}" class="btn btn-sm btn-outline-primary">View Details</a>
            </div>
          </div>
        `;
        caseList.appendChild(card);
      });
    })
    .catch(err => {
      console.error("Dashboard structural loading error context:", err);
      caseList.innerHTML = "<div class='col-12 text-center'><p class='text-danger'>⚠️ Failed to load your personal folder history records.</p></div>";
    });
});