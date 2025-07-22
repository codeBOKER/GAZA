import unicodedata
import re
from difflib import SequenceMatcher

def normalize_company_name(name):
    """
    Normalize company name for better matching:
    - Remove accents/diacritics
    - Convert to lowercase
    - Remove common company suffixes
    - Remove extra spaces and punctuation
    """
    if not name:
        return ""
    
    # Remove accents and diacritics
    normalized = unicodedata.normalize('NFD', name)
    normalized = ''.join(char for char in normalized if unicodedata.category(char) != 'Mn')
    
    # Convert to lowercase
    normalized = normalized.lower()
    
    # Remove common company suffixes and words
    company_suffixes = [
        'inc', 'corp', 'corporation', 'company', 'co', 'ltd', 'limited', 
        'llc', 'plc', 'sa', 'ag', 'gmbh', 'bv', 'nv', 'spa', 'srl',
        'the', 'group', 'international', 'global', 'worldwide'
    ]
    
    # Split into words and filter out suffixes
    words = re.findall(r'\b\w+\b', normalized)
    filtered_words = [word for word in words if word not in company_suffixes]
    
    # Join back and clean up
    normalized = ' '.join(filtered_words)
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    return normalized

def calculate_similarity(name1, name2):
    """Calculate similarity between two company names (0.0 to 1.0)"""
    if not name1 or not name2:
        return 0.0
    
    # Normalize both names
    norm1 = normalize_company_name(name1)
    norm2 = normalize_company_name(name2)
    
    if norm1 == norm2:
        return 1.0
    
    # Use SequenceMatcher for similarity
    similarity = SequenceMatcher(None, norm1, norm2).ratio()
    
    # Also check if one is contained in the other (for partial matches)
    if norm1 in norm2 or norm2 in norm1:
        similarity = max(similarity, 0.8)
    
    return similarity

def is_fuzzy_match(input_name, db_name, threshold=0.75):
    """
    Check if two company names are a fuzzy match
    
    Args:
        input_name: Company name from AI analysis
        db_name: Company name from database
        threshold: Minimum similarity score (0.0 to 1.0)
    
    Returns:
        bool: True if names are similar enough
    """
    similarity = calculate_similarity(input_name, db_name)
    return similarity >= threshold

def find_best_company_match(input_name, company_list, threshold=0.75):
    """
    Find the best matching company from a list
    
    Args:
        input_name: Company name to match
        company_list: List of company objects with company_name attribute
        threshold: Minimum similarity score
    
    Returns:
        tuple: (best_match_company, similarity_score) or (None, 0.0)
    """
    best_match = None
    best_score = 0.0
    
    for company in company_list:
        score = calculate_similarity(input_name, company.company_name)
        if score >= threshold and score > best_score:
            best_match = company
            best_score = score
    
    return best_match, best_score
