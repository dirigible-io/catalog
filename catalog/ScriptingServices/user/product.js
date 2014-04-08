var systemLib = require('system');
var ioLib = require('io');

// get method type
var method = request.getMethod();
method = method.toUpperCase();

//get primary keys (one primary key is supported!)
var idParameter = getPrimaryKey();

// retrieve the id as parameter if exist 
var id = xss.escapeSql(request.getParameter(idParameter));
var count = xss.escapeSql(request.getParameter('count'));
var metadata = xss.escapeSql(request.getParameter('metadata'));
var sort = xss.escapeSql(request.getParameter('sort'));
var limit = xss.escapeSql(request.getParameter('limit'));
var offset = xss.escapeSql(request.getParameter('offset'));
var desc = xss.escapeSql(request.getParameter('desc'));

if (limit === null) {
	limit = 100;
}
if (offset === null) {
	offset = 0;
}

if(!hasConflictingParameters()){
    // switch based on method type
    if ((method === 'GET')) {
            readDs_catalog_itemsList();
    } else {
        makeError(javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST, 1, "Invalid HTTP Method");
    }    
}



// flush and close the response
response.getWriter().flush();
response.getWriter().close();

function hasConflictingParameters(){
    if(id !== null && count !== null){
        makeError(javax.servlet.http.HttpServletResponse.SC_EXPECTATION_FAILED, 1, "Precondition failed: conflicting parameters - id, count");
        return true;
    }
    if(id !== null && metadata !== null){
        makeError(javax.servlet.http.HttpServletResponse.SC_EXPECTATION_FAILED, 1, "Precondition failed: conflicting parameters - id, metadata");
        return true;
    }
    return false;
}

function isInputParameterValid(paramName){
    var param = request.getParameter(paramName);
    if(param === null || param === undefined){
        makeError(javax.servlet.http.HttpServletResponse.SC_PRECONDITION_FAILED, 1, "Expected parameter is missing: " + paramName);
        return false;
    }
    return true;
}

// print error
function makeError(httpCode, errCode, errMessage) {
    var body = {'err': {'code': errCode, 'message': errMessage}};
    response.setStatus(httpCode);
    response.setHeader("Content-Type", "application/json");
    response.getWriter().print(JSON.stringify(body));
}

// read all entities and print them as JSON array to response
function readDs_catalog_itemsList() {
    var connection = datasource.getConnection();
    try {
        var sql = "SELECT T.ID, T.NAME, I.TITLE, I.SHORT_DESCRIPTION, I.LONG_DESCRIPTION, I.IMAGE FROM CATALOG_TYPE T JOIN CATALOG_ITEM I ON T.ID = I.TYPE_ID";
        var statement = connection.prepareStatement(sql);
        var resultSet = statement.executeQuery();
        var value;
        // while (resultSet.next()) {
        //     result.push(createEntity(resultSet));
        // }
        var result = createResultData(resultSet);
        var text = JSON.stringify(result, null, 2);
        response.getWriter().println(text);
    } catch(e){
        var errorCode = javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST;
        makeError(errorCode, errorCode, e.message);
    } finally {
        connection.close();
    }
}

function createResultData(resultSet){
    var result = [];
    while(resultSet.next()){
        var type = {};
        type.id = resultSet.getInt("ID");
        type.category = resultSet.getString("NAME");
        
        var item = {};
        item.title = resultSet.getString("TITLE");
        item.short_description = resultSet.getString("SHORT_DESCRIPTION");
        item.long_description = resultSet.getString("LONG_DESCRIPTION");
        item.image = resultSet.getString("IMAGE");
        
        var found = false;
        for(var i = 0 ; i < result.length; i ++){
            if(result[i].id == type.id){
                result[i].items.push(item);
                found = true;
                break;
            }
        }
        
        if(!found){
            type.items = [];
            type.items.push(item);
            result.push(type);
        }
    }
    return result;
}
//create entity as JSON object from ResultSet current Row
function createEntity(resultSet, data) {
    var result = {};
	result.id = resultSet.getInt("ID");
    result.category = resultSet.getString("NAME");
    result.title = resultSet.getString("TITLE");
    result.short_description = resultSet.getString("SHORT_DESCRIPTION");
    result.long_description = resultSet.getString("LONG_DESCRIPTION");
    result.image = resultSet.getString("IMAGE");
    return result;
}

function getPrimaryKeys(){
    var result = [];
    var i = 0;
    result[i++] = 'ID';
    if (result === 0) {
        throw new Exception("There is no primary key");
    } else if(result.length > 1) {
        throw new Exception("More than one Primary Key is not supported.");
    }
    return result;
}

function getPrimaryKey(){
	return getPrimaryKeys()[0].toLowerCase();
}

function pkToSQL(){
    var pks = getPrimaryKeys();
    return pks[0] + " = ?";
}
