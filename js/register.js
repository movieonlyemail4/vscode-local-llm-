$(function(){

	$("#registerform").submit(function(e){	
		e.preventDefault();
		e.stopPropagation();

      var name = $("#name").val();
      var username = $("#username").val();
      var studentid = $("#studentid").val();
	var password = $("#password").val();

		var obj = new Object();
      obj.name = name;
      obj.username = username;
	obj.studentid = studentid;
	obj.password = password;

      $.ajax({
         type: "post",
         contentType: 'application/json',
         url: 'http://localhost/fyp/api/registration',
         data: JSON.stringify(obj),            
         dataType: "json",
         success: function(data){
            if (data.insertstatus) {
               alert("Registration successful");
            	window.location.href = "http://localhost/fyp/login.html";
            } 
            else {
            	alert("Registration failed!\nError: " + data.error);
            }
         },
         error: function() {
            console.log("error");
         }
      });  
	});

   $("#btnlogin").click(function(e){
      window.location.href = "http://localhost/fyp/login.html";
   });
});