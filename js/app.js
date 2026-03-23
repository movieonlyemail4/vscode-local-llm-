$(function(){

	//not yet sign in
	if (!sessionStorage.token)
  		window.location.href = "http://localhost/fyp/login.html";	
  	else {
  		$("body").show();
  		$("#login").html(sessionStorage.login);
  	}

   $.ajaxSetup({
      statusCode: {
         401: function(){
            window.location.href = "http://localhost/fyp/login.html";
         }
      }
   });  

   $.ajaxPrefilter(function( options, oriOptions, jqXHR ) {
      jqXHR.setRequestHeader("Authorization", "Bearer " + sessionStorage.token);
   });  

	function parseHash(newHash, oldHash){
	  crossroads.parse(newHash);
	}

	var route1 = crossroads.addRoute('', function(){

	   var homeTemplate = Handlebars.templates['home'];		
		$("#divcontent").empty();
		$("#divcontent").html(homeTemplate).hide().fadeIn(1000);

		$(".breadcrumb").empty();
		$(".breadcrumb").append("<li class='active'>Home</li>");

		$(".navbar-collapse li").removeClass('active');
	  	$(".navbar-collapse li a[href='#home']").parent().addClass('active');
	});

	var route2 = crossroads.addRoute('/home', function(){
		console.log(sessionStorage.studentid);
	   var homeTemplate = Handlebars.templates['home'];
		$("#divcontent").empty();
		$("#divcontent").html(homeTemplate).hide().fadeIn(1000);

		$(".breadcrumb").empty();
		$(".breadcrumb").append("<li class='active'>Home</li> ");

		$(".navbar-collapse li").removeClass('active');
	  	$(".navbar-collapse li a[href='#home']").parent().addClass('active');
	});

	  /////////////////////////////////////////////////////PROPOSAL STUDENT
	  var route3 = crossroads.addRoute('/proposalStudent', function(){
		var id = sessionStorage.studentid;
		console.log(id);
		$.ajax({
		   type: "GET",
		   url: "http://localhost/fyp/api/proposalS/"+id,
		   dataType: "json",
		   success: function(data){
					 console.log(data);

				  var contactsTemplate = Handlebars.templates['proposalS']({"proposal": data});
				  $("#divcontent").empty();
				  $("#divcontent").html(contactsTemplate).hide().fadeIn(1000);
  
  
				  $(".breadcrumb").empty();
				  $(".breadcrumb").append("<li ><a href='#home'>Home</a></li> /");
				  $(".breadcrumb").append("<li class='active'>Proposal</li>");
  
				  $(".navbar-collapse li").removeClass('active');
					$(".navbar-collapse li a[href='proposal']").parent().addClass('active');				
		   },
		   error: function(m) {
			  console.log(m.responseText);
			  alert("1 - An error occurred while processing JSON file. MAIN ERROR1!!!!");
		   }
		});
	  });
	  //ADD PROPOSAL
	  var route3b = crossroads.addRoute('/proposalStudent/addproposal', function(){

		var proposalInsertFormTemplate = Handlebars.templates['proposalinsertform'];
		  $('#divcontent').empty();
		  $('#divcontent').html(proposalInsertFormTemplate).hide().fadeIn(1000);
	
			$(".breadcrumb").empty();
			$(".breadcrumb").append("<li><a href='#home'>Home</a></li>/");
			$(".breadcrumb").append("<li><a href='#proposal'>Proposal</a></li>/")
			$(".breadcrumb").append("<li class='active'>Add Proposal</li>");
	
			  $("#navbar li").removeClass('active');
			  $("#navbar li a[href='#proposal']").parent().addClass('active');
	});
	//VIEW PROPOSAL
	var route3c = crossroads.addRoute('/proposalStudent/view/{id}', function(id){

		$.ajax({
		   type: "GET",
		   url: "http://localhost/fyp/api/proposal/" + id,
		   dataType: "json",
		   success: function(data){
					var proposalViewFormTemplate = Handlebars.templates['proposalSviewform']({
						id: id,
						studentid: data.studentid,
						title: data.title,
						type: data.type,
						status: data.status,
					});
				$('#divcontent').empty();
				$('#divcontent').html(proposalViewFormTemplate).hide().fadeIn(1000);
  
				  $(".breadcrumb").empty();
				  $(".breadcrumb").append("<li><a href='#home'>Home</a></li> /");
				  $(".breadcrumb").append("<li><a href='#proposalStudent'>Proposal</a></li> /")
				  $(".breadcrumb").append("<li class='active'>View Proposal</li>");
  
					$("#navbar li").removeClass('active');
					$("#navbar li a[href='#proposal']").parent().addClass('active');
					
				

		   },
		   error: function() {
			  alert("An error occurred while processing JSON file. MAIN ERROR!!!!");
		   }
		});
	  });
	
	  /////////////////////////////////////////////////////PROPOSAL ADMIN
	var route4 = crossroads.addRoute('/proposal', function(){
		$.ajax({
		   type: "GET",
		   url: "http://localhost/fyp/api/proposal",
		   dataType: "json",
		   success: function(data){
				  var proposalTemplate = Handlebars.templates['proposal']({"proposal": data});
				  $("#divcontent").empty();
				  $("#divcontent").html(proposalTemplate).hide().fadeIn(1000);
				  $(".breadcrumb").empty();
				  $(".breadcrumb").append("<li ><a href='#home'>Home</a></li> /");
				  $(".breadcrumb").append("<li class='active'>Proposal</li>");
  
				  $(".navbar-collapse li").removeClass('active');
					$(".navbar-collapse li a[href='proposal']").parent().addClass('active');				
		   },
		   error: function(m) {
			  console.log(m.responseText);
			  alert("1 - An error occurred while processing JSON file. MAIN ERROR1!!!!");
		   }
		});
	  });
	//VIEW PROPOSAL
	var route4b = crossroads.addRoute('/proposal/view/{id}', function(id){

		$.ajax({
		   type: "GET",
		   url: "http://localhost/fyp/api/proposal/" + id,
		   dataType: "json",
		   success: function(data){
					var proposalViewFormTemplate = Handlebars.templates['proposalviewform']({
						id: id,
						studentid: data.studentid,
						title: data.title,
						type: data.type,
						status: data.status,
					});
				$('#divcontent').empty();
				$('#divcontent').html(proposalViewFormTemplate).hide().fadeIn(1000);
  
				  $(".breadcrumb").empty();
				  $(".breadcrumb").append("<li><a href='#home'>Home</a></li> /");
				  $(".breadcrumb").append("<li><a href='#proposal'>Proposal</a></li> /")
				  $(".breadcrumb").append("<li class='active'>View Proposal</li>");
  
					$("#navbar li").removeClass('active');
					$("#navbar li a[href='#proposal']").parent().addClass('active');	  					   
		   },
		   error: function() {
			  alert("An error occurred while processing JSON file. MAIN ERROR!!!!");
		   }
		});
	  });




	var route5 = crossroads.addRoute('/about', function(){

		var aboutTemplate = Handlebars.templates['about'];		
		$("#divcontent").empty();
		$("#divcontent").html(aboutTemplate).hide().fadeIn(1000);
		
		$(".breadcrumb").empty();
		$(".breadcrumb").append("<li><a href='#home'>Home</a></li>/");
		$(".breadcrumb").append("<li class='active'>About</li>");

		$(".navbar-collapse li").removeClass('active');
	  	$(".navbar-collapse li a[href='#about']").parent().addClass('active');
	});

	var route6 = crossroads.addRoute('/profile', function(){

		var profileTemplate = Handlebars.templates['profile'];		
		$("#divcontent").empty();
		$("#divcontent").html(profileTemplate).hide().fadeIn(1000);

		$(".breadcrumb").empty();
		$(".breadcrumb").append("<li><a href='#home'>Home</a></li>");
		$(".breadcrumb").append("<li class='active'>Profile</li>");

		$(".navbar-collapse li").removeClass('active');
	});

	var route7 = crossroads.addRoute('/logout', function(){
		$("body").hide();
		sessionStorage.clear();
		window.location.href = "http://localhost/fyp/login.html";
	});	

	hasher.initialized.add(parseHash); //parse initial hash
	hasher.changed.add(parseHash); //parse hash changes
	hasher.init(); //start listening for history change

	//////////////////////////////////////////////////////////////// PROPOSAL
	//add proposal
	$(document).on('submit','#formaddproposal',function(e) {	
		e.preventDefault();
		e.stopPropagation();

		var title = $("#title").val();
		var type = $("#type").val();
		var studentid = sessionStorage.studentid;

		//validation
		//return

		var obj = new Object();
		obj.title = title;
		obj.type = type;
		obj.studentid = studentid;
		console.log(obj);
      $.ajax({
         type: "POST", //POST FOR ADD
         url: "http://localhost/fyp/api/proposal",
         dataType: "json",
         data: JSON.stringify(obj), 
         success: function(data){   

         	if (data.insertstatus) {
         		bootbox.alert("Proposal insertion successful!", function(answer) {
         			//location.href= "/#contacts";  
         			$("#formaddproposal")[0].reset();	
         		});         		
         	} else {
         		bootbox.alert("Proposal insertion failed!\n" + data.error);
         		$("#formaddproposal")[0].reset();			
         	}     
     		},
         error: function(m) {
			console.log(m.responseText);
         	alert("An error occurred while processing JSON file. MAIN ERROR!!!!");
         }
      });			
	});

	//UPDATE ADMIN
	$(document).on('submit','#formupdateproposal',function(e) {	
		e.preventDefault();
		e.stopPropagation();
		var index = $("#index").val();
		var studentid = $("#studentid").val();
		var title = $("#title").val();
		var type = $("#type").val();
		var status = $("#status").val();
		//validation
		//return
		console.log(index);
		var obj = new Object();
		obj.index = index;
		obj.title = title;
		obj.type = type;
		obj.status = status;
		obj.studentid = studentid;

      $.ajax({
         type: "PUT",
         url: "http://localhost/fyp/api/proposal/" + studentid,
         dataType: "json",
         data: JSON.stringify(obj), 
         success: function(data){   
         	if (data.updatestatus) {
				console.log(data);
         		bootbox.alert("Proposal update successful!", function(answer) {
         		});         		
         	} else {
         		bootbox.alert("Proposal insertion failed!\n" + data.error);		
         	}     
     		},
         error: function(m) {
			console.log(m.responseText);
         	alert("An error occurred while processing JSON file. MAIN ERROR!!!!");
         }
      });			
	});	

		//UPDATE STUDENT
		$(document).on('submit','#formupdateproposalS',function(e) {	
			e.preventDefault();
			e.stopPropagation();
			var index = $("#index").val();
			var studentid = $("#studentid").val();
			var title = $("#title").val();
			var type = $("#type").val();
			//validation
			//return
			console.log(index);
			var obj = new Object();
			obj.index = index;
			obj.title = title;
			obj.type = type;
			obj.studentid = studentid;
	
		  $.ajax({
			 type: "PUT",
			 url: "http://localhost/fyp/api/proposalS/" + studentid,
			 dataType: "json",
			 data: JSON.stringify(obj), 
			 success: function(data){   
				 if (data.updatestatus) {
					console.log(data);
					 bootbox.alert("Proposal update successful!", function(answer) {
					 });         		
				 } else {
					 bootbox.alert("Proposal insertion failed!\n" + data.error);		
				 }     
				 },
			 error: function(m) {
				console.log(m.responseText);
				 alert("An error occurred while processing JSON file. MAIN ERROR!!!!");
			 }
		  });			
		});	


	//CONTACT
	$(document).on('submit','#formaddcontact',function(e) {	
		e.preventDefault();
		e.stopPropagation();

		var name = $("#name").val();
		var email = $("#email").val();
		var mobileno = $("#mobileno").val();

		//validation
		//return

		var obj = new Object();
		obj.name = name;
		obj.email = email;
		obj.mobileno = mobileno;

      $.ajax({
         type: "POST",
         url: "http://localhost/contacts/api/contacts",
         dataType: "json",
         data: JSON.stringify(obj), 
         success: function(data){   

         	if (data.insertstatus) {
         		bootbox.alert("Contact insertion successful!", function(answer) {
         			//location.href= "/#contacts";  
         			$("#formaddcontact")[0].reset();	
         		});         		
         	} else {
         		bootbox.alert("Contact insertion failed!\n" + data.error);
         		$("#formaddcontact")[0].reset();			
         	}     
     		},
         error: function() {
         	alert("An error occurred while processing JSON file. MAIN ERROR!!!!");
         }
      });			
	});

	$(document).on('submit','#formupdatecontact',function(e) {	
		e.preventDefault();
		e.stopPropagation();

		var contactid = $("#contactid").val();
		var name = $("#name").val();
		var email = $("#email").val();
		var mobileno = $("#mobileno").val();

		//validation
		//return

		var obj = new Object();
		obj.name = name;
		obj.email = email;
		obj.mobileno = mobileno;

      $.ajax({
         type: "PUT",
         url: "http://localhost/contacts/api/contacts/" + contactid,
         dataType: "json",
         data: JSON.stringify(obj), 
         success: function(data){   

         	if (data.updatestatus) {
         		bootbox.alert("Contact update successful!", function(answer) {
         		});         		
         	} else {
         		bootbox.alert("Contact insertion failed!\n" + data.error);		
         	}     
     		},
         error: function(m) {
			console.log(m.responseText);
         	alert("An error occurred while processing JSON file. MAIN ERROR!!!!");
         }
      });			
	});	

	//parent followed by the dynamic content
  	$(document).on("click", "#tbl1 tbody span", function() {
  		//             span    a        td       tr  
    	var parentTR = $(this).parent().parent().parent();
    	var contactid = $(this).data("contactid");

    	//*
	   bootbox.confirm("Are you sure you want to delete the contact?", function(answer) {
	      if (answer) {

	        	$.ajax({
	          	type: 'DELETE',
	          	url: "http://localhost/contacts/api/contacts/" + contactid,
	          	dataType: "json",
	          	success: function(data){
	              	if (data.deletestatus) {
	                	$(parentTR).fadeOut("slow", "swing", function(){
	                		$(parentTR).remove();
	                	}); 
	              	}
	          	},
	          	error: function() {
	           		alert("An error occurred while processing JSON file.");
	          	}
	        	});
	      }
    	});   
    	//*/	
	  });
	  
	  //DELETE FUNCTION PROPOSAL
	  $(document).on("click", "#tblproposal tbody span", function() {
		//             span    a        td       tr  
	  var parentTR = $(this).parent().parent().parent();
	  var proposalid = $(this).data("proposalid");

	  //*
	 bootbox.confirm("Are you sure you want to delete the proposal?", function(answer) {
		if (answer) {

			  $.ajax({
				type: 'DELETE',
				url: "http://localhost/fyp/api/proposal/" + proposalid,
				dataType: "json",
				success: function(data){
					if (data.deletestatus) {
					  $(parentTR).fadeOut("slow", "swing", function(){
						  $(parentTR).remove();
					  }); 
					}
				},
				error: function(m) {
					console.log(m.responseText);
					 alert("An error occurred while processing JSON file.");
				}
			  });
		}
	  });   
	  //*/	
	});
});