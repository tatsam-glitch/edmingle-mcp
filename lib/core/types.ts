export type HttpMethod = 'GET' | 'POST' | 'DELETE';
export type BodyMode = 'none' | 'json' | 'jsonString' | 'urlencoded' | 'formdata';
// NOTE: Edmingle's write convention is a form field named `JSONString` holding the JSON
// payload (82/88 POSTs). 'jsonString' => client sends `JSONString=<JSON.stringify(body)>`
// as application/x-www-form-urlencoded. 'json' => raw application/json (rare). 'formdata'
// => multipart with extra fields incl. file uploads (file upload unsupported in v1).

export interface CatalogParam {
  key: string;
  example?: string;
}

export interface CatalogEntry {
  id: string;                 // stable slug, unique
  name: string;               // human name from the collection
  section: string;            // top-level folder
  folderPath: string[];       // full folder trail (excludes the request name)
  method: HttpMethod;
  pathTemplate: string;       // relative to base URL, e.g. "course/{courseId}/publish"
  absoluteUrl: boolean;       // true => pathTemplate is a full https URL
  pathParams: string[];       // names found as {x} in pathTemplate
  queryParams: CatalogParam[];
  headerParams: string[];     // non-auth headers the endpoint declares
  bodyMode: BodyMode;
  bodyExample: unknown;       // example body from the collection
  description: string;
  destructive: boolean;
}
