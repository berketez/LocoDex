"""
LocoDex DeepSearch System
Enterprise-level AI-powered research and information retrieval system
Inspired by Grok DeepSearch but designed for local models

Author: LocoDex Team
Version: 2.0.0
License: MIT
"""

import asyncio
import aiohttp
import json
import time
import hashlib
import logging
import sqlite3
import threading
import queue
import re
import urllib.parse
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set, Union
from dataclasses import dataclass, asdict
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict, deque
import numpy as np
import pandas as pd
from bs4 import BeautifulSoup
import requests
from urllib.robotparser import RobotFileParser
from urllib.parse import urljoin, urlparse, parse_qs
import xml.etree.ElementTree as ET
from textstat import flesch_reading_ease, flesch_kincaid_grade
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer, WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
import spacy
import transformers
from sentence_transformers import SentenceTransformer
import faiss
import redis
import pymongo
from elasticsearch import Elasticsearch
import networkx as nx
from pyvis.network import Network
import plotly.graph_objects as go
import plotly.express as px
from wordcloud import WordCloud
import matplotlib.pyplot as plt
import seaborn as sns
from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import celery
from celery import Celery
import docker
import kubernetes
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import opentelemetry
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
    nltk.download('averaged_perceptron_tagger', quiet=True)
    nltk.download('vader_lexicon', quiet=True)
except:
    pass

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("Warning: spaCy English model not found. Install with: python -m spacy download en_core_web_sm")
    nlp = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('deepsearch.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Metrics
SEARCH_REQUESTS = Counter('deepsearch_requests_total', 'Total search requests')
SEARCH_DURATION = Histogram('deepsearch_duration_seconds', 'Search duration')
ACTIVE_CRAWLERS = Gauge('deepsearch_active_crawlers', 'Number of active crawlers')
INDEXED_PAGES = Counter('deepsearch_indexed_pages_total', 'Total indexed pages')

@dataclass
class SearchQuery:
    """Represents a search query with metadata"""
    query: str
    user_id: str
    session_id: str
    timestamp: datetime
    language: str = "en"
    search_type: str = "deep"  # deep, quick, academic, news
    filters: Dict[str, Any] = None
    max_results: int = 50
    max_depth: int = 3
    include_images: bool = True
    include_videos: bool = True
    include_social: bool = True
    time_range: str = "all"  # all, day, week, month, year
    domain_filter: List[str] = None
    exclude_domains: List[str] = None
    content_type: List[str] = None  # article, blog, academic, news, social
    
    def __post_init__(self):
        if self.filters is None:
            self.filters = {}
        if self.domain_filter is None:
            self.domain_filter = []
        if self.exclude_domains is None:
            self.exclude_domains = []
        if self.content_type is None:
            self.content_type = ["article", "blog", "news"]

@dataclass
class SearchResult:
    """Represents a search result with comprehensive metadata"""
    url: str
    title: str
    content: str
    summary: str
    relevance_score: float
    credibility_score: float
    freshness_score: float
    domain: str
    author: str = ""
    publish_date: Optional[datetime] = None
    last_modified: Optional[datetime] = None
    content_type: str = "article"
    language: str = "en"
    word_count: int = 0
    reading_time: int = 0
    sentiment_score: float = 0.0
    entities: List[Dict[str, Any]] = None
    keywords: List[str] = None
    images: List[str] = None
    videos: List[str] = None
    links: List[str] = None
    citations: List[str] = None
    social_signals: Dict[str, int] = None
    technical_metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.entities is None:
            self.entities = []
        if self.keywords is None:
            self.keywords = []
        if self.images is None:
            self.images = []
        if self.videos is None:
            self.videos = []
        if self.links is None:
            self.links = []
        if self.citations is None:
            self.citations = []
        if self.social_signals is None:
            self.social_signals = {}
        if self.technical_metadata is None:
            self.technical_metadata = {}

@dataclass
class CrawlJob:
    """Represents a crawling job"""
    url: str
    depth: int
    priority: int
    parent_url: str = ""
    job_type: str = "standard"  # standard, academic, news, social
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = "pending"  # pending, running, completed, failed
    retry_count: int = 0
    max_retries: int = 3
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.metadata is None:
            self.metadata = {}

class DatabaseManager:
    """Manages all database operations for DeepSearch"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.sqlite_path = config.get('sqlite_path', 'deepsearch.db')
        self.redis_client = None
        self.mongo_client = None
        self.es_client = None
        self.setup_databases()
    
    def setup_databases(self):
        """Initialize all database connections"""
        # SQLite for metadata and relationships
        self.setup_sqlite()
        
        # Redis for caching and real-time data
        if self.config.get('redis_enabled', True):
            self.setup_redis()
        
        # MongoDB for document storage
        if self.config.get('mongodb_enabled', False):
            self.setup_mongodb()
        
        # Elasticsearch for full-text search
        if self.config.get('elasticsearch_enabled', False):
            self.setup_elasticsearch()
    
    def setup_sqlite(self):
        """Setup SQLite database with all required tables"""
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        
        # Search queries table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS search_queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                user_id TEXT,
                session_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                language TEXT DEFAULT 'en',
                search_type TEXT DEFAULT 'deep',
                filters TEXT,
                results_count INTEGER DEFAULT 0,
                execution_time REAL DEFAULT 0.0,
                status TEXT DEFAULT 'pending'
            )
        ''')
        
        # Crawled pages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS crawled_pages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                title TEXT,
                content TEXT,
                summary TEXT,
                domain TEXT,
                author TEXT,
                publish_date DATETIME,
                last_modified DATETIME,
                content_type TEXT,
                language TEXT DEFAULT 'en',
                word_count INTEGER DEFAULT 0,
                crawl_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active',
                hash TEXT,
                metadata TEXT
            )
        ''')
        
        # Page links table (for link graph analysis)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS page_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_url TEXT NOT NULL,
                target_url TEXT NOT NULL,
                anchor_text TEXT,
                link_type TEXT DEFAULT 'internal',
                discovered_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(source_url, target_url)
            )
        ''')
        
        # Domain authority table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS domain_authority (
                domain TEXT PRIMARY KEY,
                authority_score REAL DEFAULT 0.0,
                trust_score REAL DEFAULT 0.0,
                spam_score REAL DEFAULT 0.0,
                page_count INTEGER DEFAULT 0,
                backlink_count INTEGER DEFAULT 0,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        ''')
        
        # Search results table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS search_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query_id INTEGER,
                page_id INTEGER,
                relevance_score REAL,
                credibility_score REAL,
                freshness_score REAL,
                final_score REAL,
                rank_position INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (query_id) REFERENCES search_queries (id),
                FOREIGN KEY (page_id) REFERENCES crawled_pages (id)
            )
        ''')
        
        # Entities table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS entities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                page_id INTEGER,
                entity_text TEXT,
                entity_type TEXT,
                confidence REAL,
                start_pos INTEGER,
                end_pos INTEGER,
                metadata TEXT,
                FOREIGN KEY (page_id) REFERENCES crawled_pages (id)
            )
        ''')
        
        # Keywords table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS keywords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                page_id INTEGER,
                keyword TEXT,
                frequency INTEGER,
                tfidf_score REAL,
                position_score REAL,
                importance_score REAL,
                FOREIGN KEY (page_id) REFERENCES crawled_pages (id)
            )
        ''')
        
        # Crawl queue table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS crawl_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                depth INTEGER DEFAULT 0,
                priority INTEGER DEFAULT 5,
                parent_url TEXT,
                job_type TEXT DEFAULT 'standard',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                started_at DATETIME,
                completed_at DATETIME,
                status TEXT DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                error_message TEXT,
                metadata TEXT
            )
        ''')
        
        # User sessions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                search_count INTEGER DEFAULT 0,
                preferences TEXT,
                metadata TEXT
            )
        ''')
        
        # Create indexes for better performance
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_crawled_pages_url ON crawled_pages(url)",
            "CREATE INDEX IF NOT EXISTS idx_crawled_pages_domain ON crawled_pages(domain)",
            "CREATE INDEX IF NOT EXISTS idx_crawled_pages_content_type ON crawled_pages(content_type)",
            "CREATE INDEX IF NOT EXISTS idx_crawled_pages_publish_date ON crawled_pages(publish_date)",
            "CREATE INDEX IF NOT EXISTS idx_page_links_source ON page_links(source_url)",
            "CREATE INDEX IF NOT EXISTS idx_page_links_target ON page_links(target_url)",
            "CREATE INDEX IF NOT EXISTS idx_search_queries_user ON search_queries(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_search_queries_timestamp ON search_queries(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_search_results_query ON search_results(query_id)",
            "CREATE INDEX IF NOT EXISTS idx_search_results_score ON search_results(final_score)",
            "CREATE INDEX IF NOT EXISTS idx_entities_page ON entities(page_id)",
            "CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type)",
            "CREATE INDEX IF NOT EXISTS idx_keywords_page ON keywords(page_id)",
            "CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword)",
            "CREATE INDEX IF NOT EXISTS idx_crawl_queue_status ON crawl_queue(status)",
            "CREATE INDEX IF NOT EXISTS idx_crawl_queue_priority ON crawl_queue(priority)"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        conn.commit()
        conn.close()
        logger.info("SQLite database initialized successfully")
    
    def setup_redis(self):
        """Setup Redis connection for caching"""
        try:
            import redis
            import os
            self.redis_client = redis.Redis(
                host=self.config.get('redis_host', os.getenv('REDIS_HOST', 'localhost')),
                port=self.config.get('redis_port', int(os.getenv('REDIS_PORT', 6379))),
                password=self.config.get('redis_password', os.getenv('REDIS_PASSWORD')),
                db=self.config.get('redis_db', 0),
                decode_responses=True
            )
            self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None
    
    def setup_mongodb(self):
        """Setup MongoDB connection for document storage"""
        try:
            import pymongo
            self.mongo_client = pymongo.MongoClient(
                self.config.get('mongodb_uri', 'mongodb://localhost:27017/')
            )
            self.mongo_db = self.mongo_client[self.config.get('mongodb_db', 'deepsearch')]
            logger.info("MongoDB connection established")
        except Exception as e:
            logger.warning(f"MongoDB connection failed: {e}")
            self.mongo_client = None
    
    def setup_elasticsearch(self):
        """Setup Elasticsearch connection for full-text search"""
        try:
            from elasticsearch import Elasticsearch
            self.es_client = Elasticsearch([
                self.config.get('elasticsearch_host', 'localhost:9200')
            ])
            if self.es_client.ping():
                logger.info("Elasticsearch connection established")
            else:
                self.es_client = None
        except Exception as e:
            logger.warning(f"Elasticsearch connection failed: {e}")
            self.es_client = None

class ContentExtractor:
    """Advanced content extraction from web pages"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LocoDex-DeepSearch/2.0 (+https://locodex.ai/bot)'
        })
        
    def extract_content(self, url: str, html: str = None) -> Dict[str, Any]:
        """Extract comprehensive content from a web page"""
        if html is None:
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                html = response.text
            except Exception as e:
                logger.error(f"Failed to fetch {url}: {e}")
                return {}
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "aside"]):
            script.decompose()
        
        content_data = {
            'url': url,
            'title': self._extract_title(soup),
            'content': self._extract_main_content(soup),
            'summary': '',
            'author': self._extract_author(soup),
            'publish_date': self._extract_publish_date(soup),
            'last_modified': self._extract_last_modified(soup),
            'content_type': self._detect_content_type(soup, url),
            'language': self._detect_language(soup),
            'images': self._extract_images(soup, url),
            'videos': self._extract_videos(soup, url),
            'links': self._extract_links(soup, url),
            'citations': self._extract_citations(soup),
            'metadata': self._extract_metadata(soup),
            'social_signals': self._extract_social_signals(soup),
            'technical_metadata': self._extract_technical_metadata(soup)
        }
        
        # Calculate derived metrics
        content_data['word_count'] = len(content_data['content'].split())
        content_data['reading_time'] = max(1, content_data['word_count'] // 200)
        content_data['summary'] = self._generate_summary(content_data['content'])
        
        return content_data
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract page title with fallbacks"""
        # Try Open Graph title first
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            return og_title['content'].strip()
        
        # Try Twitter title
        twitter_title = soup.find('meta', attrs={'name': 'twitter:title'})
        if twitter_title and twitter_title.get('content'):
            return twitter_title['content'].strip()
        
        # Try regular title tag
        title_tag = soup.find('title')
        if title_tag:
            return title_tag.get_text().strip()
        
        # Try h1 as fallback
        h1 = soup.find('h1')
        if h1:
            return h1.get_text().strip()
        
        return "Untitled"
    
    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        """Extract main content using multiple strategies"""
        content_selectors = [
            'article',
            '[role="main"]',
            '.content',
            '.post-content',
            '.entry-content',
            '.article-content',
            '.main-content',
            '#content',
            '#main'
        ]
        
        # Try structured content selectors first
        for selector in content_selectors:
            elements = soup.select(selector)
            if elements:
                content = ' '.join([elem.get_text(strip=True) for elem in elements])
                if len(content) > 100:  # Minimum content length
                    return content
        
        # Fallback to body content with noise removal
        body = soup.find('body')
        if body:
            # Remove common noise elements
            for noise in body.find_all(['nav', 'footer', 'aside', 'header', '.sidebar', '.menu']):
                noise.decompose()
            
            # Extract paragraphs and headings
            content_elements = body.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'])
            content = ' '.join([elem.get_text(strip=True) for elem in content_elements])
            return content
        
        return soup.get_text(strip=True)
    
    def _extract_author(self, soup: BeautifulSoup) -> str:
        """Extract author information"""
        # Try various author meta tags
        author_selectors = [
            'meta[name="author"]',
            'meta[property="article:author"]',
            'meta[name="twitter:creator"]',
            '.author',
            '.byline',
            '[rel="author"]'
        ]
        
        for selector in author_selectors:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    return element.get('content', '').strip()
                else:
                    return element.get_text(strip=True)
        
        return ""
    
    def _extract_publish_date(self, soup: BeautifulSoup) -> Optional[datetime]:
        """Extract publication date"""
        date_selectors = [
            'meta[property="article:published_time"]',
            'meta[name="date"]',
            'meta[name="publish_date"]',
            'time[datetime]',
            '.publish-date',
            '.date'
        ]
        
        for selector in date_selectors:
            element = soup.select_one(selector)
            if element:
                date_str = ""
                if element.name == 'meta':
                    date_str = element.get('content', '')
                elif element.name == 'time':
                    date_str = element.get('datetime', '') or element.get_text(strip=True)
                else:
                    date_str = element.get_text(strip=True)
                
                if date_str:
                    try:
                        return self._parse_date(date_str)
                    except:
                        continue
        
        return None
    
    def _extract_last_modified(self, soup: BeautifulSoup) -> Optional[datetime]:
        """Extract last modified date"""
        modified_selectors = [
            'meta[property="article:modified_time"]',
            'meta[name="last-modified"]',
            'meta[http-equiv="last-modified"]'
        ]
        
        for selector in modified_selectors:
            element = soup.select_one(selector)
            if element and element.get('content'):
                try:
                    return self._parse_date(element['content'])
                except:
                    continue
        
        return None
    
    def _detect_content_type(self, soup: BeautifulSoup, url: str) -> str:
        """Detect content type based on various signals"""
        # Check meta tags
        og_type = soup.find('meta', property='og:type')
        if og_type and og_type.get('content'):
            return og_type['content']
        
        # Check URL patterns
        url_lower = url.lower()
        if '/blog/' in url_lower or '/post/' in url_lower:
            return 'blog'
        elif '/news/' in url_lower or '/article/' in url_lower:
            return 'news'
        elif '/wiki/' in url_lower:
            return 'wiki'
        elif '/paper/' in url_lower or '/research/' in url_lower:
            return 'academic'
        elif '/product/' in url_lower or '/shop/' in url_lower:
            return 'product'
        
        # Check content structure
        if soup.find_all('cite') or soup.find_all('.citation'):
            return 'academic'
        elif soup.find_all('.price') or soup.find_all('[data-price]'):
            return 'product'
        
        return 'article'
    
    def _detect_language(self, soup: BeautifulSoup) -> str:
        """Detect content language"""
        # Check html lang attribute
        html_tag = soup.find('html')
        if html_tag and html_tag.get('lang'):
            return html_tag['lang'][:2]
        
        # Check meta tags
        lang_meta = soup.find('meta', attrs={'http-equiv': 'content-language'})
        if lang_meta and lang_meta.get('content'):
            return lang_meta['content'][:2]
        
        return 'en'  # Default to English
    
    def _extract_images(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract image URLs"""
        images = []
        
        # Find all img tags
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src')
            if src:
                full_url = urljoin(base_url, src)
                if self._is_valid_image_url(full_url):
                    images.append(full_url)
        
        # Check Open Graph images
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            images.append(urljoin(base_url, og_image['content']))
        
        return list(set(images))  # Remove duplicates
    
    def _extract_videos(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract video URLs"""
        videos = []
        
        # Find video tags
        for video in soup.find_all('video'):
            src = video.get('src')
            if src:
                videos.append(urljoin(base_url, src))
            
            # Check source tags within video
            for source in video.find_all('source'):
                src = source.get('src')
                if src:
                    videos.append(urljoin(base_url, src))
        
        # Check for embedded videos
        for iframe in soup.find_all('iframe'):
            src = iframe.get('src', '')
            if any(domain in src for domain in ['youtube.com', 'vimeo.com', 'dailymotion.com']):
                videos.append(src)
        
        return list(set(videos))
    
    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract outbound links"""
        links = []
        base_domain = urlparse(base_url).netloc
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)
            
            # Only include external links
            if parsed.netloc and parsed.netloc != base_domain:
                links.append(full_url)
        
        return list(set(links))
    
    def _extract_citations(self, soup: BeautifulSoup) -> List[str]:
        """Extract academic citations"""
        citations = []
        
        # Look for citation elements
        for cite in soup.find_all(['cite', '.citation', '.reference']):
            citation_text = cite.get_text(strip=True)
            if citation_text and len(citation_text) > 10:
                citations.append(citation_text)
        
        return citations
    
    def _extract_metadata(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract various metadata"""
        metadata = {}
        
        # Extract all meta tags
        for meta in soup.find_all('meta'):
            name = meta.get('name') or meta.get('property') or meta.get('http-equiv')
            content = meta.get('content')
            if name and content:
                metadata[name] = content
        
        return metadata
    
    def _extract_social_signals(self, soup: BeautifulSoup) -> Dict[str, int]:
        """Extract social media signals"""
        signals = {}
        
        # Look for social share counts (this would need API integration for real data)
        social_selectors = {
            'facebook_shares': '.fb-share-count, .facebook-count',
            'twitter_shares': '.twitter-count, .tweet-count',
            'linkedin_shares': '.linkedin-count',
            'pinterest_shares': '.pinterest-count'
        }
        
        for signal_type, selector in social_selectors.items():
            element = soup.select_one(selector)
            if element:
                try:
                    count_text = element.get_text(strip=True)
                    count = int(re.sub(r'[^\d]', '', count_text))
                    signals[signal_type] = count
                except:
                    pass
        
        return signals
    
    def _extract_technical_metadata(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract technical metadata"""
        metadata = {}
        
        # Page structure analysis
        metadata['heading_count'] = {
            'h1': len(soup.find_all('h1')),
            'h2': len(soup.find_all('h2')),
            'h3': len(soup.find_all('h3')),
            'h4': len(soup.find_all('h4')),
            'h5': len(soup.find_all('h5')),
            'h6': len(soup.find_all('h6'))
        }
        
        metadata['link_count'] = len(soup.find_all('a', href=True))
        metadata['image_count'] = len(soup.find_all('img'))
        metadata['paragraph_count'] = len(soup.find_all('p'))
        metadata['list_count'] = len(soup.find_all(['ul', 'ol']))
        metadata['table_count'] = len(soup.find_all('table'))
        
        # Check for structured data
        structured_data = []
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string)
                structured_data.append(data)
            except:
                pass
        
        metadata['structured_data'] = structured_data
        
        return metadata
    
    def _generate_summary(self, content: str, max_sentences: int = 3) -> str:
        """Generate a summary of the content"""
        if not content or len(content) < 100:
            return content
        
        try:
            sentences = sent_tokenize(content)
            if len(sentences) <= max_sentences:
                return content
            
            # Simple extractive summarization
            # In a real implementation, you might use more sophisticated methods
            sentence_scores = {}
            words = word_tokenize(content.lower())
            word_freq = {}
            
            # Calculate word frequencies
            for word in words:
                if word.isalnum():
                    word_freq[word] = word_freq.get(word, 0) + 1
            
            # Score sentences based on word frequencies
            for sentence in sentences:
                sentence_words = word_tokenize(sentence.lower())
                score = 0
                word_count = 0
                for word in sentence_words:
                    if word in word_freq:
                        score += word_freq[word]
                        word_count += 1
                if word_count > 0:
                    sentence_scores[sentence] = score / word_count
            
            # Get top sentences
            top_sentences = sorted(sentence_scores.items(), key=lambda x: x[1], reverse=True)[:max_sentences]
            summary_sentences = [sent[0] for sent in top_sentences]
            
            return ' '.join(summary_sentences)
        
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            # Fallback to first few sentences
            sentences = content.split('. ')
            return '. '.join(sentences[:max_sentences]) + '.'
    
    def _parse_date(self, date_str: str) -> datetime:
        """Parse date string into datetime object"""
        import dateutil.parser
        return dateutil.parser.parse(date_str)
    
    def _is_valid_image_url(self, url: str) -> bool:
        """Check if URL is a valid image"""
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'}
        parsed = urlparse(url)
        path = parsed.path.lower()
        return any(path.endswith(ext) for ext in image_extensions)

class WebCrawler:
    """Advanced web crawler with respect for robots.txt and rate limiting"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': 'LocoDex-DeepSearch/2.0 (+https://locodex.ai/bot)'}
        )
        self.robots_cache = {}
        self.rate_limiters = defaultdict(lambda: deque())
        self.content_extractor = ContentExtractor()
        
        # Crawling limits
        self.max_pages_per_domain = config.get('max_pages_per_domain', 100)
        self.crawl_delay = config.get('crawl_delay', 1.0)
        self.max_concurrent = config.get('max_concurrent_crawls', 10)
        self.respect_robots = config.get('respect_robots', True)
        
        # Domain-specific settings
        self.domain_settings = {
            'wikipedia.org': {'delay': 0.5, 'max_pages': 500},
            'arxiv.org': {'delay': 1.0, 'max_pages': 200},
            'github.com': {'delay': 0.5, 'max_pages': 100},
            'stackoverflow.com': {'delay': 1.0, 'max_pages': 200},
            'reddit.com': {'delay': 2.0, 'max_pages': 50},
            'twitter.com': {'delay': 2.0, 'max_pages': 50},
            'linkedin.com': {'delay': 2.0, 'max_pages': 30}
        }
        
        # Blocked domains
        self.blocked_domains = {
            'facebook.com', 'instagram.com', 'tiktok.com',
            'pinterest.com', 'snapchat.com'
        }
    
    async def crawl_url(self, url: str, depth: int = 0) -> Optional[Dict[str, Any]]:
        """Crawl a single URL and extract content"""
        try:
            domain = urlparse(url).netloc
            
            # Check if domain is blocked
            if domain in self.blocked_domains:
                logger.info(f"Skipping blocked domain: {domain}")
                return None
            
            # Check robots.txt
            if self.respect_robots and not await self._can_crawl(url):
                logger.info(f"Robots.txt disallows crawling: {url}")
                return None
            
            # Rate limiting
            await self._rate_limit(domain)
            
            # Fetch the page
            async with self.session.get(url) as response:
                if response.status != 200:
                    logger.warning(f"HTTP {response.status} for {url}")
                    return None
                
                content_type = response.headers.get('content-type', '').lower()
                if 'text/html' not in content_type:
                    logger.info(f"Skipping non-HTML content: {url}")
                    return None
                
                html = await response.text()
                
                # Extract content
                content_data = self.content_extractor.extract_content(url, html)
                content_data['crawl_depth'] = depth
                content_data['crawl_timestamp'] = datetime.now()
                
                return content_data
        
        except Exception as e:
            logger.error(f"Failed to crawl {url}: {e}")
            return None
    
    async def _can_crawl(self, url: str) -> bool:
        """Check if URL can be crawled according to robots.txt"""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc
            
            if domain not in self.robots_cache:
                robots_url = f"{parsed.scheme}://{domain}/robots.txt"
                try:
                    async with self.session.get(robots_url) as response:
                        if response.status == 200:
                            robots_content = await response.text()
                            rp = RobotFileParser()
                            rp.set_url(robots_url)
                            rp.read()
                            self.robots_cache[domain] = rp
                        else:
                            self.robots_cache[domain] = None
                except:
                    self.robots_cache[domain] = None
            
            robots = self.robots_cache[domain]
            if robots:
                return robots.can_fetch('LocoDex-DeepSearch', url)
            
            return True
        
        except Exception as e:
            logger.error(f"Error checking robots.txt for {url}: {e}")
            return True
    
    async def _rate_limit(self, domain: str):
        """Implement rate limiting per domain"""
        now = time.time()
        domain_settings = self.domain_settings.get(domain, {})
        delay = domain_settings.get('delay', self.crawl_delay)
        
        # Clean old timestamps
        while (self.rate_limiters[domain] and 
               now - self.rate_limiters[domain][0] > 60):
            self.rate_limiters[domain].popleft()
        
        # Check if we need to wait
        if self.rate_limiters[domain]:
            last_request = self.rate_limiters[domain][-1]
            time_since_last = now - last_request
            if time_since_last < delay:
                await asyncio.sleep(delay - time_since_last)
        
        self.rate_limiters[domain].append(time.time())
    
    async def close(self):
        """Close the crawler session"""
        await self.session.close()

class SemanticAnalyzer:
    """Advanced semantic analysis and NLP processing"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.stemmer = PorterStemmer()
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
        
        # Load sentence transformer for embeddings
        try:
            self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        except:
            logger.warning("SentenceTransformer model not available")
            self.sentence_model = None
        
        # Initialize TF-IDF vectorizer
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=10000,
            stop_words='english',
            ngram_range=(1, 3),
            min_df=2,
            max_df=0.8
        )
        
        # Entity recognition
        self.nlp = nlp
    
    def analyze_content(self, content: str) -> Dict[str, Any]:
        """Perform comprehensive semantic analysis"""
        analysis = {}
        
        # Basic text statistics
        analysis['text_stats'] = self._calculate_text_stats(content)
        
        # Extract keywords
        analysis['keywords'] = self._extract_keywords(content)
        
        # Named entity recognition
        analysis['entities'] = self._extract_entities(content)
        
        # Sentiment analysis
        analysis['sentiment'] = self._analyze_sentiment(content)
        
        # Topic modeling
        analysis['topics'] = self._extract_topics(content)
        
        # Readability scores
        analysis['readability'] = self._calculate_readability(content)
        
        # Generate embeddings
        analysis['embeddings'] = self._generate_embeddings(content)
        
        return analysis
    
    def _calculate_text_stats(self, content: str) -> Dict[str, Any]:
        """Calculate basic text statistics"""
        words = word_tokenize(content)
        sentences = sent_tokenize(content)
        
        return {
            'word_count': len(words),
            'sentence_count': len(sentences),
            'character_count': len(content),
            'avg_words_per_sentence': len(words) / len(sentences) if sentences else 0,
            'avg_characters_per_word': len(content) / len(words) if words else 0
        }
    
    def _extract_keywords(self, content: str, top_k: int = 20) -> List[Dict[str, Any]]:
        """Extract important keywords using TF-IDF"""
        try:
            # Preprocess text
            words = word_tokenize(content.lower())
            words = [word for word in words if word.isalnum() and word not in self.stop_words]
            processed_content = ' '.join(words)
            
            # Calculate TF-IDF
            tfidf_matrix = self.tfidf_vectorizer.fit_transform([processed_content])
            feature_names = self.tfidf_vectorizer.get_feature_names_out()
            tfidf_scores = tfidf_matrix.toarray()[0]
            
            # Get top keywords
            keyword_scores = list(zip(feature_names, tfidf_scores))
            keyword_scores.sort(key=lambda x: x[1], reverse=True)
            
            keywords = []
            for keyword, score in keyword_scores[:top_k]:
                if score > 0:
                    keywords.append({
                        'keyword': keyword,
                        'score': float(score),
                        'frequency': content.lower().count(keyword)
                    })
            
            return keywords
        
        except Exception as e:
            logger.error(f"Keyword extraction failed: {e}")
            return []
    
    def _extract_entities(self, content: str) -> List[Dict[str, Any]]:
        """Extract named entities using spaCy"""
        if not self.nlp:
            return []
        
        try:
            doc = self.nlp(content[:1000000])  # Limit content length for performance
            entities = []
            
            for ent in doc.ents:
                entities.append({
                    'text': ent.text,
                    'label': ent.label_,
                    'description': spacy.explain(ent.label_),
                    'start': ent.start_char,
                    'end': ent.end_char,
                    'confidence': float(ent._.get('confidence', 0.0)) if hasattr(ent._, 'confidence') else 0.0
                })
            
            return entities
        
        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
            return []
    
    def _analyze_sentiment(self, content: str) -> Dict[str, float]:
        """Analyze sentiment using VADER"""
        try:
            from nltk.sentiment import SentimentIntensityAnalyzer
            sia = SentimentIntensityAnalyzer()
            scores = sia.polarity_scores(content)
            return {
                'positive': scores['pos'],
                'negative': scores['neg'],
                'neutral': scores['neu'],
                'compound': scores['compound']
            }
        except Exception as e:
            logger.error(f"Sentiment analysis failed: {e}")
            return {'positive': 0.0, 'negative': 0.0, 'neutral': 1.0, 'compound': 0.0}
    
    def _extract_topics(self, content: str, num_topics: int = 5) -> List[Dict[str, Any]]:
        """Extract topics using simple keyword clustering"""
        try:
            keywords = self._extract_keywords(content, top_k=50)
            if len(keywords) < num_topics:
                return [{'topic': f"Topic {i+1}", 'keywords': keywords[i:i+1]} 
                       for i in range(len(keywords))]
            
            # Simple clustering based on keyword similarity
            # In a real implementation, you might use LDA or other topic modeling techniques
            topics = []
            keywords_per_topic = len(keywords) // num_topics
            
            for i in range(num_topics):
                start_idx = i * keywords_per_topic
                end_idx = start_idx + keywords_per_topic if i < num_topics - 1 else len(keywords)
                topic_keywords = keywords[start_idx:end_idx]
                
                topics.append({
                    'topic': f"Topic {i+1}",
                    'keywords': topic_keywords,
                    'weight': sum(kw['score'] for kw in topic_keywords)
                })
            
            return topics
        
        except Exception as e:
            logger.error(f"Topic extraction failed: {e}")
            return []
    
    def _calculate_readability(self, content: str) -> Dict[str, float]:
        """Calculate readability scores"""
        try:
            return {
                'flesch_reading_ease': flesch_reading_ease(content),
                'flesch_kincaid_grade': flesch_kincaid_grade(content)
            }
        except Exception as e:
            logger.error(f"Readability calculation failed: {e}")
            return {'flesch_reading_ease': 0.0, 'flesch_kincaid_grade': 0.0}
    
    def _generate_embeddings(self, content: str) -> Optional[List[float]]:
        """Generate sentence embeddings"""
        if not self.sentence_model:
            return None
        
        try:
            # Truncate content if too long
            if len(content) > 5000:
                content = content[:5000]
            
            embeddings = self.sentence_model.encode(content)
            return embeddings.tolist()
        
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return None

class CredibilityAnalyzer:
    """Analyze source credibility and trustworthiness"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        
        # Trusted domains with base scores
        self.trusted_domains = {
            'wikipedia.org': 0.95,
            'arxiv.org': 0.90,
            'nature.com': 0.95,
            'science.org': 0.95,
            'pubmed.ncbi.nlm.nih.gov': 0.90,
            'scholar.google.com': 0.85,
            'ieee.org': 0.90,
            'acm.org': 0.90,
            'springer.com': 0.85,
            'elsevier.com': 0.85,
            'wiley.com': 0.85,
            'cambridge.org': 0.85,
            'oxford.ac.uk': 0.85,
            'mit.edu': 0.90,
            'stanford.edu': 0.90,
            'harvard.edu': 0.90,
            'github.com': 0.80,
            'stackoverflow.com': 0.75,
            'mozilla.org': 0.80,
            'w3.org': 0.85
        }
        
        # News sources credibility
        self.news_sources = {
            'reuters.com': 0.90,
            'ap.org': 0.90,
            'bbc.com': 0.85,
            'npr.org': 0.85,
            'pbs.org': 0.85,
            'cnn.com': 0.70,
            'nytimes.com': 0.80,
            'washingtonpost.com': 0.80,
            'theguardian.com': 0.80,
            'wsj.com': 0.80,
            'economist.com': 0.85,
            'ft.com': 0.85
        }
        
        # Low credibility indicators
        self.low_credibility_indicators = {
            'clickbait_domains': {
                'buzzfeed.com', 'upworthy.com', 'viral.com',
                'clickhole.com', 'distractify.com'
            },
            'suspicious_tlds': {
                '.tk', '.ml', '.ga', '.cf', '.click', '.download'
            },
            'spam_keywords': {
                'miracle cure', 'doctors hate', 'one weird trick',
                'shocking truth', 'secret revealed', 'instant results'
            }
        }
    
    def analyze_credibility(self, result: SearchResult) -> float:
        """Calculate comprehensive credibility score"""
        scores = {}
        
        # Domain authority score
        scores['domain'] = self._calculate_domain_score(result.domain)
        
        # Content quality score
        scores['content'] = self._calculate_content_quality_score(result)
        
        # Author credibility score
        scores['author'] = self._calculate_author_score(result.author)
        
        # Freshness score
        scores['freshness'] = self._calculate_freshness_score(result.publish_date)
        
        # Citation score
        scores['citations'] = self._calculate_citation_score(result.citations)
        
        # Technical indicators score
        scores['technical'] = self._calculate_technical_score(result)
        
        # Social signals score
        scores['social'] = self._calculate_social_score(result.social_signals)
        
        # Spam detection score
        scores['spam'] = self._calculate_spam_score(result)
        
        # Calculate weighted final score
        weights = {
            'domain': 0.25,
            'content': 0.20,
            'author': 0.15,
            'freshness': 0.10,
            'citations': 0.10,
            'technical': 0.10,
            'social': 0.05,
            'spam': 0.05
        }
        
        final_score = sum(scores[key] * weights[key] for key in scores)
        
        # Apply penalties for low credibility indicators
        final_score *= self._apply_credibility_penalties(result)
        
        return max(0.0, min(1.0, final_score))
    
    def _calculate_domain_score(self, domain: str) -> float:
        """Calculate domain authority score"""
        domain_lower = domain.lower()
        
        # Check trusted domains
        if domain_lower in self.trusted_domains:
            return self.trusted_domains[domain_lower]
        
        # Check news sources
        if domain_lower in self.news_sources:
            return self.news_sources[domain_lower]
        
        # Check for educational domains
        if domain_lower.endswith('.edu'):
            return 0.85
        
        # Check for government domains
        if domain_lower.endswith('.gov'):
            return 0.90
        
        # Check for organization domains
        if domain_lower.endswith('.org'):
            return 0.70
        
        # Check for suspicious TLDs
        for tld in self.low_credibility_indicators['suspicious_tlds']:
            if domain_lower.endswith(tld):
                return 0.30
        
        # Default score for unknown domains
        return 0.50
    
    def _calculate_content_quality_score(self, result: SearchResult) -> float:
        """Calculate content quality score"""
        score = 0.5  # Base score
        
        # Word count factor
        if result.word_count > 1000:
            score += 0.2
        elif result.word_count > 500:
            score += 0.1
        elif result.word_count < 100:
            score -= 0.2
        
        # Check for structured content
        if result.technical_metadata:
            headings = result.technical_metadata.get('heading_count', {})
            total_headings = sum(headings.values())
            if total_headings > 3:
                score += 0.1
            
            # Check for lists and tables (indicates structured content)
            if result.technical_metadata.get('list_count', 0) > 0:
                score += 0.05
            if result.technical_metadata.get('table_count', 0) > 0:
                score += 0.05
        
        # Check for images (indicates effort in content creation)
        if len(result.images) > 0:
            score += 0.1
        
        return max(0.0, min(1.0, score))
    
    def _calculate_author_score(self, author: str) -> float:
        """Calculate author credibility score"""
        if not author:
            return 0.3
        
        score = 0.5  # Base score for having an author
        
        # Check for academic titles
        academic_titles = ['dr.', 'prof.', 'ph.d', 'md', 'phd']
        if any(title in author.lower() for title in academic_titles):
            score += 0.3
        
        # Check for institutional affiliations
        institutions = ['university', 'institute', 'college', 'research']
        if any(inst in author.lower() for inst in institutions):
            score += 0.2
        
        return max(0.0, min(1.0, score))
    
    def _calculate_freshness_score(self, publish_date: Optional[datetime]) -> float:
        """Calculate freshness score based on publication date"""
        if not publish_date:
            return 0.3
        
        now = datetime.now()
        age_days = (now - publish_date).days
        
        if age_days < 7:
            return 1.0
        elif age_days < 30:
            return 0.9
        elif age_days < 90:
            return 0.8
        elif age_days < 365:
            return 0.7
        elif age_days < 1095:  # 3 years
            return 0.6
        else:
            return 0.4
    
    def _calculate_citation_score(self, citations: List[str]) -> float:
        """Calculate score based on citations"""
        if not citations:
            return 0.3
        
        citation_count = len(citations)
        if citation_count >= 10:
            return 1.0
        elif citation_count >= 5:
            return 0.8
        elif citation_count >= 1:
            return 0.6
        else:
            return 0.3
    
    def _calculate_technical_score(self, result: SearchResult) -> float:
        """Calculate score based on technical indicators"""
        score = 0.5
        
        if result.technical_metadata:
            # Check for structured data
            if result.technical_metadata.get('structured_data'):
                score += 0.2
            
            # Check for proper HTML structure
            headings = result.technical_metadata.get('heading_count', {})
            if headings.get('h1', 0) == 1:  # Proper single H1
                score += 0.1
            
            # Check for meta descriptions and other SEO indicators
            # This would be expanded based on available metadata
        
        return max(0.0, min(1.0, score))
    
    def _calculate_social_score(self, social_signals: Dict[str, int]) -> float:
        """Calculate score based on social media signals"""
        if not social_signals:
            return 0.5
        
        total_shares = sum(social_signals.values())
        
        if total_shares >= 1000:
            return 1.0
        elif total_shares >= 100:
            return 0.8
        elif total_shares >= 10:
            return 0.6
        else:
            return 0.4
    
    def _calculate_spam_score(self, result: SearchResult) -> float:
        """Calculate spam detection score (higher is better)"""
        content_lower = result.content.lower()
        title_lower = result.title.lower()
        
        spam_indicators = 0
        
        # Check for spam keywords
        for keyword in self.low_credibility_indicators['spam_keywords']:
            if keyword in content_lower or keyword in title_lower:
                spam_indicators += 1
        
        # Check for excessive capitalization
        if sum(1 for c in result.title if c.isupper()) / len(result.title) > 0.5:
            spam_indicators += 1
        
        # Check for excessive punctuation
        if result.title.count('!') > 2 or result.title.count('?') > 2:
            spam_indicators += 1
        
        # Return inverse score (fewer spam indicators = higher score)
        return max(0.0, 1.0 - (spam_indicators * 0.2))
    
    def _apply_credibility_penalties(self, result: SearchResult) -> float:
        """Apply penalties for low credibility indicators"""
        penalty_factor = 1.0
        
        # Check for clickbait domains
        if result.domain in self.low_credibility_indicators['clickbait_domains']:
            penalty_factor *= 0.5
        
        # Check for very short content
        if result.word_count < 50:
            penalty_factor *= 0.7
        
        # Check for missing author on news/blog content
        if result.content_type in ['news', 'blog'] and not result.author:
            penalty_factor *= 0.8
        
        return penalty_factor

class SearchEngine:
    """Main search engine orchestrating all components"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db_manager = DatabaseManager(config)
        self.crawler = WebCrawler(config)
        self.semantic_analyzer = SemanticAnalyzer(config)
        self.credibility_analyzer = CredibilityAnalyzer(config)
        
        # Search configuration
        self.max_results = config.get('max_results', 50)
        self.max_crawl_depth = config.get('max_crawl_depth', 3)
        self.enable_real_time_crawl = config.get('enable_real_time_crawl', True)
        
        # Initialize vector index for semantic search
        self.vector_index = None
        self.setup_vector_index()
        
        # Search result cache
        self.result_cache = {}
        self.cache_ttl = config.get('cache_ttl', 3600)  # 1 hour
    
    def setup_vector_index(self):
        """Setup FAISS vector index for semantic search"""
        try:
            import faiss
            # Initialize with 384 dimensions (all-MiniLM-L6-v2 embedding size)
            self.vector_index = faiss.IndexFlatIP(384)
            logger.info("Vector index initialized")
        except Exception as e:
            logger.warning(f"Vector index setup failed: {e}")
    
    async def search(self, query: SearchQuery) -> List[SearchResult]:
        """Perform comprehensive search"""
        SEARCH_REQUESTS.inc()
        start_time = time.time()
        
        try:
            # Check cache first
            cache_key = self._generate_cache_key(query)
            if cache_key in self.result_cache:
                cached_result, timestamp = self.result_cache[cache_key]
                if time.time() - timestamp < self.cache_ttl:
                    logger.info(f"Returning cached results for query: {query.query}")
                    return cached_result
            
            # Store query in database
            query_id = self._store_query(query)
            
            # Multi-stage search process
            results = []
            
            # Stage 1: Database search (existing indexed content)
            db_results = await self._search_database(query)
            results.extend(db_results)
            
            # Stage 2: Real-time web crawling (if enabled and needed)
            if (self.enable_real_time_crawl and 
                len(results) < query.max_results and 
                query.search_type == "deep"):
                
                crawl_results = await self._perform_real_time_crawl(query)
                results.extend(crawl_results)
            
            # Stage 3: Semantic reranking
            results = await self._semantic_rerank(query, results)
            
            # Stage 4: Apply filters and limits
            results = self._apply_filters(query, results)
            results = results[:query.max_results]
            
            # Stage 5: Calculate final scores
            for result in results:
                result.credibility_score = self.credibility_analyzer.analyze_credibility(result)
                result.freshness_score = self._calculate_freshness_score(result.publish_date)
                result.final_score = self._calculate_final_score(result, query)
            
            # Sort by final score
            results.sort(key=lambda x: x.final_score, reverse=True)
            
            # Store results in database
            self._store_search_results(query_id, results)
            
            # Cache results
            self.result_cache[cache_key] = (results, time.time())
            
            # Update metrics
            execution_time = time.time() - start_time
            SEARCH_DURATION.observe(execution_time)
            
            logger.info(f"Search completed: {len(results)} results in {execution_time:.2f}s")
            return results
        
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    async def _search_database(self, query: SearchQuery) -> List[SearchResult]:
        """Search existing database content"""
        results = []
        
        try:
            conn = sqlite3.connect(self.db_manager.sqlite_path)
            cursor = conn.cursor()
            
            # Build search query
            search_terms = query.query.lower().split()
            where_conditions = []
            params = []
            
            # Text search conditions
            for term in search_terms:
                where_conditions.append(
                    "(LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(summary) LIKE ?)"
                )
                params.extend([f"%{term}%", f"%{term}%", f"%{term}%"])
            
            # Apply filters
            if query.domain_filter:
                domain_placeholders = ','.join(['?' for _ in query.domain_filter])
                where_conditions.append(f"domain IN ({domain_placeholders})")
                params.extend(query.domain_filter)
            
            if query.exclude_domains:
                domain_placeholders = ','.join(['?' for _ in query.exclude_domains])
                where_conditions.append(f"domain NOT IN ({domain_placeholders})")
                params.extend(query.exclude_domains)
            
            if query.content_type:
                type_placeholders = ','.join(['?' for _ in query.content_type])
                where_conditions.append(f"content_type IN ({type_placeholders})")
                params.extend(query.content_type)
            
            # Time range filter
            if query.time_range != "all":
                time_filter = self._get_time_filter(query.time_range)
                if time_filter:
                    where_conditions.append("publish_date >= ?")
                    params.append(time_filter)
            
            # Build final query
            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            sql = f"""
                SELECT url, title, content, summary, domain, author, 
                       publish_date, last_modified, content_type, language,
                       word_count, metadata
                FROM crawled_pages 
                WHERE {where_clause}
                ORDER BY last_updated DESC
                LIMIT ?
            """
            params.append(query.max_results * 2)  # Get more for filtering
            
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            
            for row in rows:
                try:
                    metadata = json.loads(row[11]) if row[11] else {}
                    
                    result = SearchResult(
                        url=row[0],
                        title=row[1],
                        content=row[2],
                        summary=row[3],
                        domain=row[4],
                        author=row[5] or "",
                        publish_date=datetime.fromisoformat(row[6]) if row[6] else None,
                        last_modified=datetime.fromisoformat(row[7]) if row[7] else None,
                        content_type=row[8],
                        language=row[9],
                        word_count=row[10],
                        relevance_score=0.0,  # Will be calculated later
                        credibility_score=0.0,
                        freshness_score=0.0,
                        **metadata
                    )
                    
                    # Calculate relevance score
                    result.relevance_score = self._calculate_relevance_score(query.query, result)
                    
                    results.append(result)
                
                except Exception as e:
                    logger.error(f"Error processing database result: {e}")
                    continue
            
            conn.close()
            
        except Exception as e:
            logger.error(f"Database search failed: {e}")
        
        return results
    
    async def _perform_real_time_crawl(self, query: SearchQuery) -> List[SearchResult]:
        """Perform real-time crawling for fresh content"""
        results = []
        
        try:
            # Generate search URLs for different search engines
            search_urls = self._generate_search_urls(query.query)
            
            # Crawl search engine results
            crawl_tasks = []
            for url in search_urls[:10]:  # Limit concurrent crawls
                task = self.crawler.crawl_url(url, depth=0)
                crawl_tasks.append(task)
            
            # Wait for crawl results
            crawl_results = await asyncio.gather(*crawl_tasks, return_exceptions=True)
            
            for crawl_result in crawl_results:
                if isinstance(crawl_result, dict):
                    # Convert to SearchResult
                    result = self._convert_crawl_to_search_result(crawl_result)
                    if result:
                        results.append(result)
                        
                        # Store in database for future searches
                        self._store_crawled_page(crawl_result)
        
        except Exception as e:
            logger.error(f"Real-time crawl failed: {e}")
        
        return results
    
    def _generate_search_urls(self, query: str) -> List[str]:
        """Generate search URLs for different search engines"""
        encoded_query = urllib.parse.quote_plus(query)
        
        # Note: In a real implementation, you would need to respect
        # search engines' terms of service and rate limits
        search_urls = [
            f"https://duckduckgo.com/html/?q={encoded_query}",
            f"https://www.bing.com/search?q={encoded_query}",
            # Add more search engines as needed
        ]
        
        return search_urls
    
    async def _semantic_rerank(self, query: SearchQuery, results: List[SearchResult]) -> List[SearchResult]:
        """Rerank results using semantic similarity"""
        if not self.semantic_analyzer.sentence_model or not results:
            return results
        
        try:
            # Generate query embedding
            query_embedding = self.semantic_analyzer.sentence_model.encode(query.query)
            
            # Calculate semantic similarity for each result
            for result in results:
                # Combine title and summary for semantic comparison
                result_text = f"{result.title} {result.summary}"
                result_embedding = self.semantic_analyzer.sentence_model.encode(result_text)
                
                # Calculate cosine similarity
                similarity = cosine_similarity(
                    query_embedding.reshape(1, -1),
                    result_embedding.reshape(1, -1)
                )[0][0]
                
                # Update relevance score with semantic similarity
                result.relevance_score = (result.relevance_score + similarity) / 2
        
        except Exception as e:
            logger.error(f"Semantic reranking failed: {e}")
        
        return results
    
    def _apply_filters(self, query: SearchQuery, results: List[SearchResult]) -> List[SearchResult]:
        """Apply additional filters to search results"""
        filtered_results = []
        
        for result in results:
            # Language filter
            if query.language != "all" and result.language != query.language:
                continue
            
            # Content type filter
            if query.content_type and result.content_type not in query.content_type:
                continue
            
            # Domain filters
            if query.domain_filter and result.domain not in query.domain_filter:
                continue
            
            if query.exclude_domains and result.domain in query.exclude_domains:
                continue
            
            # Time range filter
            if query.time_range != "all" and result.publish_date:
                time_filter = self._get_time_filter(query.time_range)
                if time_filter and result.publish_date < time_filter:
                    continue
            
            # Minimum quality threshold
            if result.word_count < 50:  # Skip very short content
                continue
            
            filtered_results.append(result)
        
        return filtered_results
    
    def _calculate_relevance_score(self, query: str, result: SearchResult) -> float:
        """Calculate relevance score between query and result"""
        query_lower = query.lower()
        title_lower = result.title.lower()
        content_lower = result.content.lower()
        
        score = 0.0
        
        # Title matching (highest weight)
        if query_lower in title_lower:
            score += 0.5
        
        # Exact phrase matching in content
        if query_lower in content_lower:
            score += 0.3
        
        # Individual word matching
        query_words = query_lower.split()
        title_words = title_lower.split()
        content_words = content_lower.split()
        
        title_matches = sum(1 for word in query_words if word in title_words)
        content_matches = sum(1 for word in query_words if word in content_words)
        
        if query_words:
            score += (title_matches / len(query_words)) * 0.3
            score += (content_matches / len(query_words)) * 0.2
        
        return min(1.0, score)
    
    def _calculate_freshness_score(self, publish_date: Optional[datetime]) -> float:
        """Calculate freshness score"""
        if not publish_date:
            return 0.5
        
        now = datetime.now()
        age_days = (now - publish_date).days
        
        if age_days < 1:
            return 1.0
        elif age_days < 7:
            return 0.9
        elif age_days < 30:
            return 0.8
        elif age_days < 90:
            return 0.7
        elif age_days < 365:
            return 0.6
        else:
            return 0.4
    
    def _calculate_final_score(self, result: SearchResult, query: SearchQuery) -> float:
        """Calculate final ranking score"""
        weights = {
            'relevance': 0.4,
            'credibility': 0.3,
            'freshness': 0.2,
            'quality': 0.1
        }
        
        # Quality score based on content length and structure
        quality_score = min(1.0, result.word_count / 1000)
        
        final_score = (
            result.relevance_score * weights['relevance'] +
            result.credibility_score * weights['credibility'] +
            result.freshness_score * weights['freshness'] +
            quality_score * weights['quality']
        )
        
        return final_score
    
    def _generate_cache_key(self, query: SearchQuery) -> str:
        """Generate cache key for query"""
        key_data = {
            'query': query.query,
            'search_type': query.search_type,
            'language': query.language,
            'time_range': query.time_range,
            'content_type': sorted(query.content_type) if query.content_type else [],
            'domain_filter': sorted(query.domain_filter) if query.domain_filter else [],
            'exclude_domains': sorted(query.exclude_domains) if query.exclude_domains else []
        }
        
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def _get_time_filter(self, time_range: str) -> Optional[datetime]:
        """Get datetime filter for time range"""
        now = datetime.now()
        
        if time_range == "day":
            return now - timedelta(days=1)
        elif time_range == "week":
            return now - timedelta(weeks=1)
        elif time_range == "month":
            return now - timedelta(days=30)
        elif time_range == "year":
            return now - timedelta(days=365)
        
        return None
    
    def _store_query(self, query: SearchQuery) -> int:
        """Store search query in database"""
        try:
            conn = sqlite3.connect(self.db_manager.sqlite_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO search_queries 
                (query, user_id, session_id, language, search_type, filters)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                query.query,
                query.user_id,
                query.session_id,
                query.language,
                query.search_type,
                json.dumps(query.filters)
            ))
            
            query_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return query_id
        
        except Exception as e:
            logger.error(f"Failed to store query: {e}")
            return 0
    
    def _store_search_results(self, query_id: int, results: List[SearchResult]):
        """Store search results in database"""
        try:
            conn = sqlite3.connect(self.db_manager.sqlite_path)
            cursor = conn.cursor()
            
            for i, result in enumerate(results):
                # First, get or create page record
                cursor.execute("SELECT id FROM crawled_pages WHERE url = ?", (result.url,))
                page_row = cursor.fetchone()
                
                if page_row:
                    page_id = page_row[0]
                else:
                    # Insert new page
                    cursor.execute("""
                        INSERT INTO crawled_pages 
                        (url, title, content, summary, domain, author, publish_date, 
                         last_modified, content_type, language, word_count, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        result.url, result.title, result.content, result.summary,
                        result.domain, result.author,
                        result.publish_date.isoformat() if result.publish_date else None,
                        result.last_modified.isoformat() if result.last_modified else None,
                        result.content_type, result.language, result.word_count,
                        json.dumps({
                            'images': result.images,
                            'videos': result.videos,
                            'links': result.links,
                            'citations': result.citations,
                            'social_signals': result.social_signals,
                            'technical_metadata': result.technical_metadata
                        })
                    ))
                    page_id = cursor.lastrowid
                
                # Insert search result
                cursor.execute("""
                    INSERT INTO search_results 
                    (query_id, page_id, relevance_score, credibility_score, 
                     freshness_score, final_score, rank_position)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    query_id, page_id, result.relevance_score,
                    result.credibility_score, result.freshness_score,
                    result.final_score, i + 1
                ))
            
            conn.commit()
            conn.close()
        
        except Exception as e:
            logger.error(f"Failed to store search results: {e}")
    
    def _store_crawled_page(self, crawl_data: Dict[str, Any]):
        """Store crawled page data in database"""
        try:
            conn = sqlite3.connect(self.db_manager.sqlite_path)
            cursor = conn.cursor()
            
            # Check if page already exists
            cursor.execute("SELECT id FROM crawled_pages WHERE url = ?", (crawl_data['url'],))
            if cursor.fetchone():
                return  # Page already exists
            
            # Insert new page
            cursor.execute("""
                INSERT OR REPLACE INTO crawled_pages 
                (url, title, content, summary, domain, author, publish_date, 
                 last_modified, content_type, language, word_count, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                crawl_data['url'],
                crawl_data['title'],
                crawl_data['content'],
                crawl_data['summary'],
                crawl_data.get('domain', ''),
                crawl_data.get('author', ''),
                crawl_data['publish_date'].isoformat() if crawl_data.get('publish_date') else None,
                crawl_data['last_modified'].isoformat() if crawl_data.get('last_modified') else None,
                crawl_data.get('content_type', 'article'),
                crawl_data.get('language', 'en'),
                crawl_data.get('word_count', 0),
                json.dumps(crawl_data.get('metadata', {}))
            ))
            
            conn.commit()
            conn.close()
            
            INDEXED_PAGES.inc()
        
        except Exception as e:
            logger.error(f"Failed to store crawled page: {e}")
    
    def _convert_crawl_to_search_result(self, crawl_data: Dict[str, Any]) -> Optional[SearchResult]:
        """Convert crawl data to SearchResult object"""
        try:
            return SearchResult(
                url=crawl_data['url'],
                title=crawl_data['title'],
                content=crawl_data['content'],
                summary=crawl_data['summary'],
                domain=crawl_data.get('domain', ''),
                author=crawl_data.get('author', ''),
                publish_date=crawl_data.get('publish_date'),
                last_modified=crawl_data.get('last_modified'),
                content_type=crawl_data.get('content_type', 'article'),
                language=crawl_data.get('language', 'en'),
                word_count=crawl_data.get('word_count', 0),
                images=crawl_data.get('images', []),
                videos=crawl_data.get('videos', []),
                links=crawl_data.get('links', []),
                citations=crawl_data.get('citations', []),
                social_signals=crawl_data.get('social_signals', {}),
                technical_metadata=crawl_data.get('technical_metadata', {}),
                relevance_score=0.0,
                credibility_score=0.0,
                freshness_score=0.0
            )
        except Exception as e:
            logger.error(f"Failed to convert crawl data: {e}")
            return None
    
    async def close(self):
        """Close all connections and cleanup"""
        await self.crawler.close()

# Flask Web API
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Global search engine instance
search_engine = None

def initialize_search_engine():
    """Initialize the search engine with configuration"""
    global search_engine
    
    config = {
        'sqlite_path': 'deepsearch.db',
        'redis_enabled': False,  # Disable for simplicity
        'mongodb_enabled': False,
        'elasticsearch_enabled': False,
        'max_results': 50,
        'max_crawl_depth': 3,
        'enable_real_time_crawl': True,
        'max_pages_per_domain': 100,
        'crawl_delay': 1.0,
        'max_concurrent_crawls': 10,
        'respect_robots': True,
        'cache_ttl': 3600
    }
    
    search_engine = SearchEngine(config)
    logger.info("Search engine initialized")

@app.route('/api/search', methods=['POST'])
async def api_search():
    """Main search API endpoint"""
    try:
        data = request.get_json()
        
        # Create search query
        query = SearchQuery(
            query=data['query'],
            user_id=data.get('user_id', 'anonymous'),
            session_id=data.get('session_id', 'default'),
            language=data.get('language', 'en'),
            search_type=data.get('search_type', 'deep'),
            max_results=data.get('max_results', 50),
            max_depth=data.get('max_depth', 3),
            time_range=data.get('time_range', 'all'),
            content_type=data.get('content_type', ['article', 'blog', 'news']),
            domain_filter=data.get('domain_filter', []),
            exclude_domains=data.get('exclude_domains', [])
        )
        
        # Perform search
        results = await search_engine.search(query)
        
        # Convert results to JSON-serializable format
        json_results = []
        for result in results:
            json_result = asdict(result)
            # Convert datetime objects to ISO strings
            if json_result['publish_date']:
                json_result['publish_date'] = result.publish_date.isoformat()
            if json_result['last_modified']:
                json_result['last_modified'] = result.last_modified.isoformat()
            json_results.append(json_result)
        
        return jsonify({
            'success': True,
            'results': json_results,
            'total_results': len(results),
            'query': query.query
        })
    
    except Exception as e:
        logger.error(f"Search API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/crawl', methods=['POST'])
async def api_crawl():
    """Manual crawl API endpoint"""
    try:
        data = request.get_json()
        url = data['url']
        depth = data.get('depth', 0)
        
        # Perform crawl
        crawl_result = await search_engine.crawler.crawl_url(url, depth)
        
        if crawl_result:
            # Store in database
            search_engine._store_crawled_page(crawl_result)
            
            return jsonify({
                'success': True,
                'result': crawl_result
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to crawl URL'
            }), 400
    
    except Exception as e:
        logger.error(f"Crawl API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/stats', methods=['GET'])
def api_stats():
    """Get system statistics"""
    try:
        conn = sqlite3.connect(search_engine.db_manager.sqlite_path)
        cursor = conn.cursor()
        
        # Get various statistics
        cursor.execute("SELECT COUNT(*) FROM crawled_pages")
        total_pages = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM search_queries")
        total_queries = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT domain) FROM crawled_pages")
        unique_domains = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT domain, COUNT(*) as count 
            FROM crawled_pages 
            GROUP BY domain 
            ORDER BY count DESC 
            LIMIT 10
        """)
        top_domains = cursor.fetchall()
        
        cursor.execute("""
            SELECT content_type, COUNT(*) as count 
            FROM crawled_pages 
            GROUP BY content_type 
            ORDER BY count DESC
        """)
        content_types = cursor.fetchall()
        
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_pages': total_pages,
                'total_queries': total_queries,
                'unique_domains': unique_domains,
                'top_domains': [{'domain': d[0], 'count': d[1]} for d in top_domains],
                'content_types': [{'type': c[0], 'count': c[1]} for c in content_types]
            }
        })
    
    except Exception as e:
        logger.error(f"Stats API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def api_health():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

@socketio.on('search_request')
def handle_search_request(data):
    """Handle real-time search requests via WebSocket"""
    try:
        # This would be implemented for real-time search updates
        emit('search_progress', {'status': 'started', 'query': data['query']})
        
        # Perform search (this would be async in real implementation)
        # For now, just emit a completion message
        emit('search_complete', {'status': 'completed', 'results_count': 0})
    
    except Exception as e:
        emit('search_error', {'error': str(e)})

if __name__ == '__main__':
    # Initialize search engine
    initialize_search_engine()
    
    # Start Prometheus metrics server
    start_http_server(8000)
    
    # Run Flask app
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)

