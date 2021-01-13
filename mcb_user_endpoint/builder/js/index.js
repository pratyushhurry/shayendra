$(document).ready(function(){
    $('table .fas').hover(
        function(){
            $(this).removeClass('zoom_out').addClass('zoom_in');
        },
        function(){
            $(this).removeClass('zoom_in').addClass('zoom_out');
        }
    );

    /*
        Client side validation
    */
    $("#new_user").find('input').focusout(function(){
        var is_valid = validate_input($(this).attr('data-type'), $(this).val());
        toggle_input_state($(this), is_valid);
    });

    $("#paginate_next").click(function(e){
        e.preventDefault();
        $("#user_pagination .active").next().find('a').click();
    });

    $("#paginate_prev").click(function(e){
        e.preventDefault();
        $("#user_pagination .active").prev().find('a').click();
    });

    $("#export_all").click(function(){
        ajax('https://jsonplaceholder.typicode.com/posts', 'GET',{}, {c: exportAll, o:['fake_all']});
    });

    $('#register_user').click(function(){
        fetch('https://jsonplaceholder.typicode.com/posts', {
          method: 'POST',
          body: JSON.stringify({
            title: $("#u_title_id").val(),
            body: $("#u_description_id").val(),
            userId: $("#user_id").val(),
          }),
          headers: {
            'Content-type': 'application/json; charset=UTF-8',
          },
        })
          .then((response) => response.json())
          .then((json) => {
            $(".toast").toast('show');
            $(".toast .toast-body").text("resource will not be really updated on the server but it will be faked as ifs");
            $("#new_user").modal('hide');
          });
    });

    $("[data-bs-target='#new_user']").click(function(){
        $("#user_id").val(Math.floor(Math.random() * 10000) + 1);
    });

    $('#submit_search').click(function(){
        searchuser();
    });
    ajax('https://jsonplaceholder.typicode.com/posts', 'GET',{}, {c: initUser});
});


//ajax, send async request to server side
function ajax(url, request_type, data, parameters){
    $.ajax({ url: url, type: request_type, data: data, statusCode:{
        200: function(){
            $(".toast").toast('show');
            $(".toast .toast-body").text("HTTP/1.1 200 Request has succeeded");
        },
        201: function(){
            $(".toast").toast('show');
            $(".toast .toast-body").text("HTTP/1.1 201 Resource created");
        },
        400: function(){
            $(".toast").toast('show');
            $(".toast .toast-body").text("HTTP/1.1 404 Bad request");
        },
        404: function(){
            $(".toast").toast('show');
            $(".toast .toast-body").text("HTTP/1.1 404 Not Found");
            console.log('');
        },
        422: function(){
            $(".toast").toast('show');
            $(".toast .toast-body").text("HTTP/1.1 422 Unprocessable Entity");
        },
        500: function(){
            $(".toast").toast('show');
            $(".toast .toast-body").text("HTTP/1.1 500 Internal Server Error");
        }
    }})
    .done(function(data){
        if(parameters.hasOwnProperty('o'))
            parameters.c(data, ...parameters.o);
        else
            parameters.c(data);
    });
}

//validate_input, client side validation
function validate_input(type, value){
    //object having different regex pattern for each input type
    const regex = {
        username: /^[a-zA-Z]+$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*?])(?=.{8,})/,
        email: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        phone: /^5[0-9]{7}/,
        none: /.*/,
        number: /^[0-9]*$/,
        text: /^[A-Za-z]+$/,
        range: /^.{0,399}$/,

        // construct a regex from the previous password field
        confirm_password: new RegExp($("[name='pass']").val())
    };

    //throws an error if the input type does not have a regex pattern
    if(!regex.hasOwnProperty(type))
        throw `Given input type does not exist, type: ${type}`;

    //if field empty, evaluate the field as valid else test for regex pattern
    return (value == '')?false:regex[type].test(value);
}

function toggle_input_state(input, state, err = null){
    //always remove previously injected element
    $(input).removeClass('is-invalid is-valid');
    $(input).data('input_valid', true);
    const input_type_exception = ['file', 'checkbox', 'hidden', 'radio', 'color', 'email'];

    //if input type is referenced as excluded for validation
    if(!state && !input_type_exception.includes($(input).attr('type'))){
        $(input).addClass('is-invalid');

        $(input).parent().find('.invalid-feedback').remove();
        var feedback = document.createElement('div');
        $(feedback).addClass('invalid-feedback');
        $(feedback).html((err == null)?$(input).attr('data-error'):err);
        $(input).parent().append(feedback);
        $(input).data('input_valid', false);
    }else if(!input_type_exception.includes($(input).attr('type'))){
        $(input).addClass('is-valid');
    }
}

//check if a form is valid
function form_valid (form){
    var bools = [];
    const input_type_exception = ['file', 'checkbox', 'hidden', 'radio'];
    $(form).find('input').each(function(index, node){
        //Used the double-not operator to type cast the values to boolean
        if(!input_type_exception.includes($(node).attr('type')))
            bools.push(!!$(node).data('input_valid'));
    });

    //evaluate the array (input state transformed as boolean based on validity)
    for(const bool of bools){
        if(!bool){
            return false;
        }
    }

    return true;
}

function initUser(deserialized_data){
    $('#user_dataset').children().detach();

    if(!jQuery.isEmptyObject(deserialized_data)){
        var table_node = $('<table></table>').addClass('table caption-top').css('text-align', 'center');
        var caption_node = $('<caption></caption>').attr('id', 'paginate_desc').text('List of users');
        var thead_node = $('<thead><th>User id</th><th>Title</th><th>Description</th><th>Accessibility</th></thead>');

        $(table_node).append(caption_node).append(thead_node);

        for(var i = 0; i < deserialized_data.length; i++){
            var tr_node = $('<tr></tr>').attr('data-id', deserialized_data[i].id);
            var id_td_node = $('<td></td>').text(deserialized_data[i].userId);
            var title_td_node = $('<td></td>').text(deserialized_data[i].title);
            var desc_td_node = $('<td></td>').attr('width', '35%').text(deserialized_data[i].body);
            var td_group_node = $('<td></td>');
            var div_node = $('<div></div>').addClass('icon-group');
            var delete_node = $('<i></i>').attr('data-type', 'delete').addClass('fas fa-trash');
            var download_node = $('<i></i>').attr('data-type', 'export').addClass('fas fa-download');

            $(div_node).append(delete_node).append(download_node);
            $(td_group_node).append(div_node);
            $(tr_node).append(id_td_node).append(title_td_node).append(desc_td_node).append(td_group_node);
            $(table_node).find('thead').after(tr_node);
        }
    }

    $('#user_dataset').append(table_node);

    $("#user_dataset [data-type='export']").click(function(){
        var node_id = $(this).parent().parent().parent().attr('data-id');
        ajax(`https://jsonplaceholder.typicode.com/posts/${node_id}`, 'GET',{}, {c: exportAll, o:[`fake_${node_id}`]});
    });

    $("#user_dataset [data-type='delete']").click(function(){
        fetch(`https://jsonplaceholder.typicode.com/posts/${$(this).parent().parent().parent().attr('data-id')}`, {
          method: 'DELETE',
        }).then((response) => {
            $(".toast").toast('show');
            $(".toast .toast-body").text("resource will not be really updated on the server but it will be faked as ifs");
        });
    });

    reloadDOM(paginateDOM($("table [data-id]"), 3), '#user_dataset');
    $("[data-role='paginate_desc']").text(`Showing - ${3} Of ${deserialized_data.length} users`);


    //ADD the pagination navigator
    $("#user_dataset").find("[data-role='pages']").each(function(index, item){
        var li_node = $('<li></li>').addClass('page-item');
        var anchor_node = $('<a></a>').addClass('page-link').attr('href', '#').text($(item).attr('data-page-id'));
        $("#user_pagination li:last").before($(li_node).append(anchor_node));

        $(anchor_node).click(function(e){
            e.preventDefault();
            $("[data-role='pages']").removeClass('hidden').addClass('hidden');
            $('#user_pagination li').removeClass('active');
            $("[data-page-id="+ $(this).text() +"]").removeClass('hidden');
            $(this).parent().addClass('active');
        });
    });

    $("#user_pagination li:nth-child(2)").addClass('active');
}

//paginate a given DOM
function paginateDOM(DOM_object, amount){
    var iteration_counter = 1;
    var page_counter = 0;
    var table_node = $('<table></table>').addClass('table caption-top').attr('data-role', 'pages').attr('data-page-id', ++page_counter);
    var caption_node = $('<caption></caption>').attr('data-role', 'paginate_desc');
    var thead_node = $('<thead><th>User id</th><th>Title</th><th>Description</th><th>Accessibility</th></thead>');

    $(table_node).append(caption_node).append(thead_node);
    var pages_collection = [];

    for(var x = 0; x < DOM_object.length; x++){
        if(iteration_counter > amount){
            table_node = $('<table></table>').addClass('table caption-top hidden').attr('data-role', 'pages').attr('data-page-id', ++page_counter);
            var caption_node = $('<caption></caption>').attr('data-role', 'paginate_desc');
            var thead_node = $('<thead><th>User id</th><th>Title</th><th>Description</th><th>Accessibility</th></thead>');
            $(table_node).append(caption_node).append(thead_node);
            iteration_counter = 1;
        }

        $(table_node).find('thead').after(DOM_object[x]);
        pages_collection.push(table_node);
        iteration_counter++;
    }

    return pages_collection;
}

function reloadDOM(DOM_object, selector, removeListener = false, after = false){
    if(!removeListener) $(selector).children().detach();

    for(var i = 0; i < DOM_object.length; i++){
        console.log(DOM_object[i]);
        if(!after){
            $(selector).append(DOM_object[i]);
        }else{
            $(selector).after(DOM_object[i]);
        }
    }
}

function exportAll(dataset, name){
    ajax('builder/xslxExporter.php', 'POST',{json_fake_dataset: JSON.stringify(Array.isArray(dataset)?dataset:[dataset]), json_fake_name: name}, {c: function(response){
        var deserialized_data = JSON.parse(response);
        window.location.href = deserialized_data.path;
    }});
}

function searchuser(){
    var text = $("#search_box").val();
    var active_dom = [];
    var collection = [];
    $("[data-role='pages']").not('.hidden').find('tr').each(function(index, item){
        active_dom.push($(item));
    });

    active_dom.shift(); // removes the header;
    for(var index = 0; index < active_dom.length; index++){
        if($(active_dom[index]).find('td:nth-child(2)').text().includes(text)){
            collection.push($(active_dom[index]));
        }
    }

    console.log(collection);
    reloadDOM(collection, $("[data-role='pages']").not('.hidden'), false, true);
}
