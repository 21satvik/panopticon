import yfinance as yf
from groq import Groq
from telemetry import observe
import os

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


class AgentResponse:
    def __init__(self, text: str, tokens: int):
        self.text = text
        self._tokens_used = tokens

    def __str__(self):
        return self.text


@observe(agent_name="retrieval_agent")
async def retrieval_agent(prompt: str, session_id: str = None) -> AgentResponse:
    ticker_map = {
        "apple": "AAPL", "nvidia": "NVDA", "microsoft": "MSFT",
        "tesla": "TSLA", "google": "GOOGL", "googl": "GOOGL",
        "amazon": "AMZN", "meta": "META", "netflix": "NFLX",
        "amd": "AMD", "intel": "INTC", "salesforce": "CRM",
        "uber": "UBER", "airbnb": "ABNB", "spotify": "SPOT",
    }
    
    ticker = None
    for name, symbol in ticker_map.items():
        if name in prompt.lower():
            ticker = symbol
            break
    
    if not ticker:
        return AgentResponse(
            text="I couldn't identify a company in your query. Try mentioning a company by name, e.g. 'Analyze Apple' or 'Research NVIDIA'.",
            tokens=0
        )

    stock = yf.Ticker(ticker)
    info = stock.info
    
    context = f"""
    Company: {info.get('longName', ticker)}
    Sector: {info.get('sector', 'N/A')}
    Current Price: ${info.get('currentPrice', 'N/A')}
    Market Cap: ${info.get('marketCap', 'N/A'):,}
    P/E Ratio: {info.get('trailingPE', 'N/A')}
    Revenue: ${info.get('totalRevenue', 'N/A'):,}
    Profit Margins: {info.get('profitMargins', 'N/A')}
    52 Week High: ${info.get('fiftyTwoWeekHigh', 'N/A')}
    52 Week Low: ${info.get('fiftyTwoWeekLow', 'N/A')}
    Analyst Recommendation: {info.get('recommendationKey', 'N/A')}
    Summary: {info.get('longBusinessSummary', 'N/A')[:500]}
    """

    result = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a financial data retrieval agent. Summarize the provided company data clearly and concisely for analysis."},
            {"role": "user", "content": f"Query: {prompt}\n\nRaw Data:\n{context}"}
        ]
    )

    return AgentResponse(
        text=result.choices[0].message.content,
        tokens=result.usage.total_tokens
    )


@observe(agent_name="analysis_agent")
async def analysis_agent(prompt: str, session_id: str = None, context: str = "") -> AgentResponse:
    result = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": """You are a financial analysis agent. 
Generate a structured investment brief with these sections:
- Executive Summary
- Key Strengths
- Key Risks  
- Financial Health
- Conclusion

Always include a disclaimer that this is not financial advice."""},
            {"role": "user", "content": f"Query: {prompt}\n\nContext:\n{context}"}
        ]
    )

    return AgentResponse(
        text=result.choices[0].message.content,
        tokens=result.usage.total_tokens
    )