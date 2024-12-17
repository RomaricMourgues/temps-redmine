  const startRedmineExtension = async () => {
    const statusEl = document.getElementById("temps-passe-status");
    const resultEl = document.getElementById("temps-passe-result");
  
    try {
      const entries = await fetchTimeEntries();
      const insufficientDays = entries.filter(day => day.total < 8);
  
      // Auto-refresh popup if there are missing days
      if (insufficientDays.length === 0) {
        statusEl.textContent = "All days are fine!";
        return;
      }
  
      statusEl.textContent = "Days with < 8 hours logged:";
      for (const day of insufficientDays) {
        const tasks = await fetchTasks(day.date);
        renderDayForm(day, tasks, resultEl);
      }
    } catch (error) {
      statusEl.textContent = "Error fetching data!";
      console.error(error);
    }
  };
  
  function renderDayForm(day, tasks, container) {
    const dayDiv = document.createElement("div");
    dayDiv.style.marginBottom = "15px";
  
    dayDiv.innerHTML = `
      <strong>${day.date}:</strong> ${8 - day.total}h missing
      <form id="temps-passe-form-${day.date.replace(/-/g, '')}">
        <label>Task:</label>
        <select id="temps-passe-task-${day.date.replace(/-/g, '')}">
          <option value="">Nothing</option>
          ${tasks.map(task => `<option value="${task.id}">${task.subject}</option>`).join("")}
        </select><br/>
        <label>Description:</label>
        <input type="text" id="temps-passe-desc-${day.date.replace(/-/g, '')}" placeholder="Work description" required /><br/>
        <label>Hours:</label>
        <input type="number" id="temps-passe-hours-${day.date.replace(/-/g, '')}" min="0" step="0.5" max="8" required /><br/>
        <button type="submit">Submit</button>
      </form>
    `;
  
    container.appendChild(dayDiv);
  
    document
      .getElementById(`temps-passe-form-${day.date.replace(/-/g, '')}`)
      .addEventListener("temps-passe-submit", e => submitTimeEntry(e, day.date));
  }
  
  async function submitTimeEntry(e, date) {
    e.preventDefault();
  
    const formId = date.replace(/-/g, '');
    const taskId = document.getElementById(`temps-passe-task-${formId}`).value;
    const description = document.getElementById(`temps-passe-desc-${formId}`).value;
    const hours = parseFloat(document.getElementById(`temps-passe-hours-${formId}`).value);
  
    const payload = {
      time_entry: {
        issue_id: taskId || undefined,
        spent_on: date,
        hours: hours,
        comments: description
      }
    };
  
    const url = `${window.location.origin}/time_entries.json`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(payload)
    });
  
    if (response.ok) {
      alert(`Time entry for ${date} submitted successfully!`);
      location.reload(); // Refresh to check if the day is still incomplete
    } else {
      alert("Failed to submit time entry.");
      console.error(await response.text());
    }
  }async function fetchTimeEntries() {
    const url = `${window.location.origin}/time_entries?c%5B%5D=project&c%5B%5D=spent_on&c%5B%5D=user&c%5B%5D=activity&c%5B%5D=issue&c%5B%5D=comments&c%5B%5D=hours&f%5B%5D=spent_on&f%5B%5D=user_id&f%5B%5D=&group_by=&op%5Bspent_on%5D=%2A&op%5Buser_id%5D=%3D&per_page=100&set_filter=1&sort=spent_on%3Adesc&t%5B%5D=hours&t%5B%5D=&utf8=✓&v%5Buser_id%5D%5B%5D=me`;
  
    // Fetch the HTML content of the time entries page
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error("Failed to fetch time entries page");
  
    // Parse the HTML response
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
  
    // Select all time entry rows
    const rows = [...doc.querySelectorAll("tr.time-entry")];
    const timeEntries = {};
  
    rows.forEach(row => {
      const dateElement = row.querySelector(".spent_on");
      const hoursElement = row.querySelector(".hours");
  
      if (dateElement && hoursElement) {
        let vdate = dateElement.textContent.trim();
        vdate = vdate.split("/").reverse().join("-");
        const date = new Date(vdate).toISOString().split("T")[0];
        const hours = parseFloat(hoursElement.textContent.trim());
  
        timeEntries[date] = timeEntries[date] || 0;
        timeEntries[date] += hours;
      }
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 9);
  
    const today = new Date().toISOString().split("T")[0];
 
    //For each 7 last days, check number of hours done and redurn {date, number}[]
    // Ignore weekends
    const days = [];
    for (let i = 0; i < 7; i++) {
      
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Pass on weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      const day = date.toISOString().split("T")[0];
      if (day !== today) {
        days.push({ date: day, total: timeEntries[day] || 0 });
      }
    }
    return days;
  }
  

  async function fetchTasks(day) {
  
    // Construct the URL for the issues page
    const url = `${window.location.origin}/issues?f%5B%5D=assigned_to_id&amp;f%5B%5D=updated_on&amp;op%5Bassigned_to_id%5D=%3D&amp;op%5Bupdated_on%5D=>t-&amp;set_filter=1&amp;sort=id%3Adesc&amp;v%5Bassigned_to_id%5D%5B%5D=me&amp;v%5Bupdated_on%5D%5B%5D=7`;
  
    // Fetch the HTML content of the issues page
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error("Failed to fetch tasks page");
  
    // Parse the HTML response
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
  
    // Select all issue rows
    const issues = [...doc.querySelectorAll("tr.issue")];
    const tasks = [];
  
    issues.forEach(issue => {
      const subjectElement = issue.querySelector(".subject a");
      const updatedOnElement = issue.querySelector(".updated_on");
  
      if (subjectElement && updatedOnElement) {
        const updatedOn = new Date(updatedOnElement.textContent.trim());
        if (updatedOn >= sevenDaysAgo) {
          tasks.push({
            id: subjectElement.href.split("/").pop(),
            subject: subjectElement.textContent.trim()
          });
        }
      }
    });
  
    return tasks;
  }
  
  (function addIcon() {
    const existingIcon = document.getElementById("temps-passe-icon");
    if (existingIcon) return;
  
    const icon = document.createElement("div");
    icon.id = "temps-passe";
    icon.textContent = "⏱️";
    icon.style.position = "fixed";
    icon.style.bottom = "10px";
    icon.style.right = "10px";
    icon.style.backgroundColor = "#f0f0f0";
    icon.style.border = "1px solid #ddd";
    icon.style.padding = "5px";
    icon.style.borderRadius = "5px";
    icon.style.cursor = "pointer";
    icon.style.zIndex = "9999";

    // Add div id="status" and div id="result" to the icon
    const statusEl = document.createElement("div");
    statusEl.id = "temps-passe-status";
    statusEl.textContent = "Loading...";
    icon.appendChild(statusEl);

    const resultEl = document.createElement("div");
    resultEl.id = "temps-passe-result";
    icon.appendChild(resultEl);
  
    document.body.appendChild(icon);

    startRedmineExtension();
  })();