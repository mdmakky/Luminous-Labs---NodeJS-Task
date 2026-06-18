# **Build a Task Assignment API with Audit Trail**

### **Objective**

Create a Node.js backend for internal task tracking with authentication, role-based access, audit history, and production-style API structure.

### **Requirements**

**Core Features**

* Use Node.js and Express/Nest. 
* Create REST APIs for: users, projects, tasks, and task comments. 
* Add JWT authentication. 
* Add roles: admin, manager, and member. 
* Task fields: title, description, priority, status, assignee, and due date. 
* Add filtering, sorting, and pagination. 
* Add centralized error handling. 
* Add validation for request payloads.
* Add an audit trail for task status changes. 
* Add tests for at least 3 important endpoints. 
* Add a README with setup instructions and API examples.

**Required Behavior**

* Admin can manage all records. 
* Manager can create and assign tasks. 
* Member can view and update only assigned tasks. 
* Every status change must be logged in the audit history. 
* Invalid payloads must return meaningful errors.

**Optional Bonus**

* Add refresh token support. 
* Add Swagger/OpenAPI docs. 
* Add Docker support. 
* Add soft delete. 
* Add activity logging for comments.

### **Deliverables**

* Full source code. 
* README file. 
* Sample.env.example. 
* Database schema or migration files. 
* Brief architecture explanation. 
* Test results or screenshots.

### **Evaluation Criteria**

* API design quality. 
* Authentication and authorization. 
* Validation and error handling. 
* Audit trail implementation. 
* Testing quality. 
* Code organization. 
* Clarity of documentation.

**Happy Coding**

