import http from "http";
import jwt from "jsonwebtoken";

const token = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);

const data = JSON.stringify({
  name: "Roaa Updated",
  role: "user",
  status: true
});

const options = {
  hostname: "localhost",
  port: 5000,
  path: "/users/1",
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": data.length,
    "Authorization": "Bearer " + token
  }
};

const req = http.request(options, (res) => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => console.log("Response:", body));
});

req.on("error", (err) => console.error(err));
req.write(data);
req.end();
