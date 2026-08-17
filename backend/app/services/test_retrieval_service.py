from app.services.retrieval_service import RetrievalService


USER_ID = "25ec1950-2b2b-43e2-9545-018cfac97d44"


def main():
    service = RetrievalService()

    query = "What programming languages does Mirudhula know?"

    results = service.retrieve(
        query=query,
        user_id=USER_ID,
        top_k=3,
    )

    print("\n" + "=" * 60)
    print("RETRIEVAL RESULTS")
    print("=" * 60)

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for index, document in enumerate(documents):
        print(f"\n--- Result {index + 1} ---")
        print(f"Distance: {distances[index]}")
        print(f"Metadata: {metadatas[index]}")
        print(f"Content:\n{document}")


if __name__ == "__main__":
    main()