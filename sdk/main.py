import asyncio
from sdk.agents import retrieval_agent, analysis_agent
import uuid


async def run_pipeline(query: str):
    session_id = str(uuid.uuid4())
    print(f"\nSession: {session_id}")
    print(f"Query: {query}\n")

    print("Agent 1 — Retrieving data...")
    retrieval_result = await retrieval_agent(prompt=query, session_id=session_id)
    print(retrieval_result.text[:200])

    print("\nAgent 2 — Analyzing...")
    analysis_result = await analysis_agent(
        prompt=query,
        session_id=session_id,
        context=retrieval_result.text
    )
    print(analysis_result.text[:200])

    print("\nPipeline complete. Telemetry shipped.")
    return analysis_result


if __name__ == "__main__":
    asyncio.run(run_pipeline("Analyze Apple as an investment"))