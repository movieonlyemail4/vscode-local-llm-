$(function(){

	$("#loginform").submit(function(e){	
		e.preventDefault();
		e.stopPropagation();

		var username = $("#username").val();
		var password = $("#password").val();

		var obj = new Object();
		obj.username = username;
		obj.password = password;
      $.ajax({
         type: "post",
         contentType: 'application/json',
         url: 'http://localhost/fyp/api/auth',
         data: JSON.stringify(obj),            
         dataType: "json",
         success: function(data){
            if (data.status == 1) {
                  console.log(data);
            	sessionStorage.token = data.token;
                  sessionStorage.username= data.username;
                  sessionStorage.studentid= data.studentid;
                 if(data.type=="admin"){
                  window.location.href = "http://localhost/fyp/index.html";
                 }
                 else{
                  window.location.href = "http://localhost/fyp/indexStudent.html";
                 }
            	//alert("Login successful!", function() {
            	
					//});

            } 
            else if (data.status == 0) {
                  console.log(data);
            	sessionStorage.clear();
            	alert("Login failed - wrong password!");
            }
            else if (data.status == -1) {
                  console.log(data);
            	sessionStorage.clear();
            	alert("Login failed - user with that email not exist!");
            }
         },
         error: function(m) {
            console.log(m.responseText);
         }
      });  
	});

   $("#btnregister").click(function(e){
      window.location.href = "http://localhost/fyp/register.html";
   });
});