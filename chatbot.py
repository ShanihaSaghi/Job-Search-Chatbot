from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import smolagents
import os

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load CSV data
dataframe = pd.read_csv("job_data.csv")

# Response style
response_style = """
Return all details in a chatbot-style explanation. It should be conversational.
"""

# Setup Gemini API
os.environ["GEMINI_API_KEY"] = "AIzaSyCUH_YQIozvPqkypOh9C0bf6ix5iHw5TjU"

from smolagents import OpenAIServerModel

model = OpenAIServerModel(
    model_id="gemini-2.5-flash",
    api_base="https://generativelanguage.googleapis.com/v1beta/openai/",
    api_key=os.environ.get("GEMINI_API_KEY"),
)

from smolagents import CodeAgent

agent = CodeAgent(
    model=model,
    tools=[],
    max_steps=4,
    additional_authorized_imports=["pandas"],
    verbosity_level=2
)

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    """Check if the backend is running"""
    return jsonify({
        'status': 'healthy',
        'message': 'Backend is running',
        'data_loaded': dataframe is not None,
        'data_rows': len(dataframe) if dataframe is not None else 0
    }), 200

# Query endpoint
@app.route('/api/query', methods=['POST'])
def query():
    """Handle user queries"""
    try:
        data = request.json
        user_query = data.get('query')
        
        if not user_query:
            return jsonify({
                'error': 'No query provided'
            }), 400
        
        # Run the agent with the query
        output = agent.run(
            user_query,
            additional_args={"job_data": dataframe, "prompt": response_style}
        )
        
        return jsonify({
            'response': output
        }), 200
        
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        return jsonify({
            'error': 'An error occurred processing your request',
            'details': str(e)
        }), 500

# Get data info endpoint with filter options
@app.route('/api/data/info', methods=['GET'])
def get_data_info():
    """Get information about the loaded data including filter options"""
    try:
        # Get unique values for filters
        filter_options = {}
        
        # Detect common column names (case-insensitive)
        columns_lower = {col.lower(): col for col in dataframe.columns}
        
        # Location filter
        location_cols = ['location', 'city', 'place', 'area', 'loc', 'YOUR_COLUMN_NAME']
        for col in location_cols:
            if col in columns_lower:
                actual_col = columns_lower[col]
                filter_options['locations'] = sorted(dataframe[actual_col].dropna().unique().tolist())
                break
        
        # Company filter
        company_cols = ['company', 'company_name', 'organization', 'employer', 'org', 'YOUR_COLUMN_NAME']
        for col in company_cols:
            if col in columns_lower:
                actual_col = columns_lower[col]
                filter_options['companies'] = sorted(dataframe[actual_col].dropna().unique().tolist())
                break
        
        # Role filter
        role_cols = ['role', 'position', 'job_title', 'title', 'designation', 'job', 'job_role', 'YOUR_COLUMN_NAME']
        for col in role_cols:
            if col in columns_lower:
                actual_col = columns_lower[col]
                filter_options['roles'] = sorted(dataframe[actual_col].dropna().unique().tolist())
                break
        
        info = {
            'rows': len(dataframe),
            'columns': list(dataframe.columns),
            'sample': dataframe.head(3).to_dict('records'),
            'filter_options': filter_options
        }
        
        return jsonify(info), 200
    except Exception as e:
        return jsonify({
            'error': 'Unable to fetch data info',
            'details': str(e)
        }), 500

# Filter endpoint
@app.route('/api/filter', methods=['POST'])
def filter_data():
    """Filter data based on provided criteria"""
    try:
        data = request.json
        filters = data.get('filters', {})
        
        if not filters:
            return jsonify({
                'error': 'No filters provided'
            }), 400
        
        # Start with the full dataframe
        filtered_df = dataframe.copy()
        
        # Detect column names (case-insensitive matching)
        columns_lower = {col.lower(): col for col in dataframe.columns}
        
        # Apply location filter
        if 'location' in filters and filters['location']:
            location_cols = ['location', 'city', 'place', 'area']
            for col in location_cols:
                if col in columns_lower:
                    actual_col = columns_lower[col]
                    filtered_df = filtered_df[filtered_df[actual_col].str.contains(filters['location'], case=False, na=False)]
                    break
        
        # Apply company filter
        if 'company' in filters and filters['company']:
            company_cols = ['company', 'company_name', 'organization', 'employer']
            for col in company_cols:
                if col in columns_lower:
                    actual_col = columns_lower[col]
                    filtered_df = filtered_df[filtered_df[actual_col].str.contains(filters['company'], case=False, na=False)]
                    break
        
        # Apply role filter
        if 'role' in filters and filters['role']:
            role_cols = ['role', 'position', 'job_title', 'title', 'designation']
            for col in role_cols:
                if col in columns_lower:
                    actual_col = columns_lower[col]
                    filtered_df = filtered_df[filtered_df[actual_col].str.contains(filters['role'], case=False, na=False)]
                    break
        
        # Apply skills filter
        if 'skills' in filters and filters['skills']:
            skills_cols = ['skills', 'required_skills', 'technologies', 'tech_stack']
            skills_list = [s.strip().lower() for s in filters['skills'].split(',')]
            
            for col in skills_cols:
                if col in columns_lower:
                    actual_col = columns_lower[col]
                    # Check if any of the skills match
                    mask = filtered_df[actual_col].apply(
                        lambda x: any(skill in str(x).lower() for skill in skills_list) if pd.notna(x) else False
                    )
                    filtered_df = filtered_df[mask]
                    break
        
        # Get results
        results = filtered_df.to_dict('records')
        count = len(results)
        
        # Limit to top 50 results for display
        if count > 50:
            results = results[:50]
        
        return jsonify({
            'results': results,
            'count': count,
            'total_count': len(dataframe)
        }), 200
        
    except Exception as e:
        print(f"Error filtering data: {str(e)}")
        return jsonify({
            'error': 'An error occurred filtering the data',
            'details': str(e)
        }), 500

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Agent AI Backend Server Starting...")
    print("=" * 60)
    print(f"✅ CSV loaded: {len(dataframe)} rows")
    print(f"✅ Columns: {', '.join(dataframe.columns.tolist())}")
    print("=" * 60)
    print("🌐 Server running on: http://localhost:5000")
    print("=" * 60)
    print("\nEndpoints:")
    print("  • GET  /api/health       - Health check")
    print("  • POST /api/query        - Send queries")
    print("  • GET  /api/data/info    - Data information & filter options")
    print("  • POST /api/filter       - Multi-filter search")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)