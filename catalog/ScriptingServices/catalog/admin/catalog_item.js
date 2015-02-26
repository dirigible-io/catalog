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
    if ((method === 'POST')) {
        // create
        createDs_catalog_items();
    } else if ((method === 'GET')) {
        // read
            readDs_catalog_itemsList();
    } else if ((method === 'PUT')) {
        // update
        updateDs_catalog_items();    
        
    } else if ((method === 'DELETE')) {
        // delete
        if(isInputParameterValid(idParameter)){
            deleteDs_catalog_items(id);
        }
        
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

function getTypeId(connection, type){
        var sql = "SELECT ID FROM CATALOG_TYPE WHERE NAME = ? ";
        var statement = connection.prepareStatement(sql);
        statement.setString(1, type);
        
        var resultSet = statement.executeQuery();
        var size = 0;
        var id;
        
        while(resultSet.next()){
            id = resultSet.getInt("ID");
            size++;
        }
        if(size != 1){
            id = undefined;
        }
        return id;
}

// create entity by parsing JSON object from request body
function createDs_catalog_items() {
    var input = ioLib.read(request.getReader());
    var message = JSON.parse(input);
    var connection = datasource.getConnection();
    try {
        var sql = "INSERT INTO CATALOG_ITEM (";
        sql += "ID";
        sql += ",";
        sql += "TITLE";
        sql += ",";
        sql += "SHORT_DESCRIPTION";
        sql += ",";
        sql += "LONG_DESCRIPTION";
        sql += ",";
        sql += "IMAGE";
        sql += ",";
        sql += "TYPE_ID";
        sql += ") VALUES ("; 
        sql += "?";
        sql += ",";
        sql += "?";
        sql += ",";
        sql += "?";
        sql += ",";
        sql += "?";
        sql += ",";
        sql += "?";
        sql += ",";
        sql += "?";
        sql += ")";

        var typeId = getTypeId(connection, message.type);
        if(typeId){
            statement = connection.prepareStatement(sql);
            var i = 0;
            var id = db.getNext('CATALOG_ITEM_ID');
            
            statement.setInt(++i, id);
            statement.setString(++i, message.title);
            statement.setString(++i, message.short_description);
            statement.setString(++i, message.long_description);
            statement.setString(++i, message.image);
            statement.setInt(++i, typeId);
            statement.executeUpdate();
            response.getWriter().println(id);
        }
    } catch(e){
        var errorCode = javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST;
        makeError(errorCode, errorCode, e.message);
    } finally {
        connection.close();
    }
}

// read single entity by id and print as JSON object to response
function readDs_catalog_itemsEntity(id) {
    var connection = datasource.getConnection();
    try {
        var result = "";
        var sql = "SELECT * FROM CATALOG_ITEM WHERE "+pkToSQL();
        var statement = connection.prepareStatement(sql);
        statement.setString(1, id);
        
        var resultSet = statement.executeQuery();
        var value;
        while (resultSet.next()) {
            result = createEntity(resultSet);
        }
        if(result.length === 0){
            makeError(javax.servlet.http.HttpServletResponse.SC_NOT_FOUND, 1, "Record with id: " + id + " does not exist.");
        }
        var text = JSON.stringify(result, null, 2);
        response.getWriter().println(text);
    } catch(e){
        var errorCode = javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST;
        makeError(errorCode, errorCode, e.message);
    } finally {
        connection.close();
    }
}

// read all entities and print them as JSON array to response
function readDs_catalog_itemsList() {
    var connection = datasource.getConnection();
    try {
        var result = [];
        var sql = "SELECT  I.ID, I.TITLE, I.SHORT_DESCRIPTION, I.LONG_DESCRIPTION, I.IMAGE, T.NAME AS TYPE FROM CATALOG_ITEM I JOIN CATALOG_TYPE T ON I.TYPE_ID = T.ID";
        var statement = connection.prepareStatement(sql);
        var resultSet = statement.executeQuery();
        var value;
        while (resultSet.next()) {
            result.push(createEntity(resultSet));
        }
        var text = JSON.stringify(result, null, 2);
        response.getWriter().println(text);
    } catch(e){
        var errorCode = javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST;
        makeError(errorCode, errorCode, e.message);
    } finally {
        connection.close();
    }
}

//create entity as JSON object from ResultSet current Row
function createEntity(resultSet, data) {
    var result = {};
	result.id = resultSet.getInt("ID");
    result.title = resultSet.getString("TITLE");
    result.short_description = resultSet.getString("SHORT_DESCRIPTION");
    result.long_description = resultSet.getString("LONG_DESCRIPTION");
    result.image = resultSet.getString("IMAGE");
	result.type = resultSet.getString("TYPE");
    return result;
}

// update entity by id
function updateDs_catalog_items() {
    var input = ioLib.read(request.getReader());
    var message = JSON.parse(input);
    var connection = datasource.getConnection();
    try {
        var sql = "UPDATE CATALOG_ITEM SET ";
        sql += "TITLE = ?";
        sql += ",";
        sql += "SHORT_DESCRIPTION = ?";
        sql += ",";
        sql += "LONG_DESCRIPTION = ?";
        sql += ",";
        sql += "IMAGE = ?";
        sql += ",";
        sql += "TYPE_ID = ?";
        sql += " WHERE ID = ?";
        
        var typeId = getTypeId(connection, message.type);
        if(typeId){
            var statement = connection.prepareStatement(sql);
            var i = 0;
            statement.setString(++i, message.title);
            statement.setString(++i, message.short_description);
            statement.setString(++i, message.long_description);
            statement.setString(++i, message.image);
            statement.setInt(++i, typeId);
            var id = "";
            id = message.id;
            statement.setInt(++i, id);
            statement.executeUpdate();
            response.getWriter().println(id);
        }
    } catch(e){
        var errorCode = javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST;
        makeError(errorCode, errorCode, e.message);
    } finally {
        connection.close();
    }
}

// delete entity
function deleteDs_catalog_items(id) {
    var connection = datasource.getConnection();
    try {
        var sql = "DELETE FROM CATALOG_ITEM WHERE "+pkToSQL();
        var statement = connection.prepareStatement(sql);
        statement.setString(1, id);
        var resultSet = statement.executeUpdate();
        response.getWriter().println(id);
    } catch(e){
        var errorCode = javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST;
        makeError(errorCode, errorCode, e.message);
    } finally {
        connection.close();
    }
}

function countDs_catalog_items() {
    var count = 0;
    var connection = datasource.getConnection();
    try {
        var statement = connection.createStatement();
        var rs = statement.executeQuery('SELECT COUNT(*) FROM CATALOG_ITEM');
        while (rs.next()) {
            count = rs.getInt(1);
        }
    } catch(e){
        var errorCode = javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST;
        makeError(errorCode, errorCode, e.message);
    } finally {
        connection.close();
    }
    response.getWriter().println(count);
}

function metadataDs_catalog_items() {
	var entityMetadata = {};
	entityMetadata.name = 'catalog_item';
	entityMetadata.type = 'object';
	entityMetadata.properties = [];
	
	var propertyid = {};
	propertyid.name = 'id';
	propertyid.type = 'integer';
	propertyid.key = 'true';
	propertyid.required = 'true';
    entityMetadata.properties.push(propertyid);

	var propertytitle = {};
	propertytitle.name = 'title';
    propertytitle.type = 'string';
    entityMetadata.properties.push(propertytitle);

	var propertydescription = {};
	propertydescription.name = 'description';
    propertydescription.type = 'string';
    entityMetadata.properties.push(propertydescription);

	var propertyimage = {};
	propertyimage.name = 'image';
    propertyimage.type = 'string';
    entityMetadata.properties.push(propertyimage);

	var propertytype = {};
	propertytype.name = 'type';
	propertytype.type = 'integer';
    entityMetadata.properties.push(propertytype);


    response.getWriter().println(JSON.stringify(entityMetadata));
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
